#include "Settings.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSettings>
#include <QtGlobal>

namespace {
// Providers shipped with the kernel; anything else is registered as a custom
// OpenAI-compatible provider.
const QStringList kBuiltinProviders = {
    "anthropic",   "openai",     "google",       "google-vertex", "openrouter",
    "groq",        "mistral",    "xai",          "amazon-bedrock", "azure",
    "cerebras",    "cohere",     "deepinfra",    "togetherai",     "perplexity",
    "vercel",      "alibaba",    "deepseek",
};

QString firstNonEmpty(const QString &a, const QString &b) {
    return a.isEmpty() ? b : a;
}
}

OcSettings OcSettings::load() {
    QSettings store("oc", "oc-client");
    OcSettings settings;
    settings.provider = firstNonEmpty(store.value("provider").toString(), qEnvironmentVariable("OC_PROVIDER"));
    settings.baseUrl = firstNonEmpty(store.value("baseUrl").toString(), qEnvironmentVariable("OC_BASE_URL"));
    settings.apiKey = firstNonEmpty(store.value("apiKey").toString(), qEnvironmentVariable("OC_API_KEY"));
    settings.model = firstNonEmpty(store.value("model").toString(), qEnvironmentVariable("OC_MODEL"));
    const int port = store.value("port", qEnvironmentVariableIntValue("OC_PORT")).toInt();
    settings.port = static_cast<quint16>(qBound(0, port, 65535));
    return settings;
}

void OcSettings::save() const {
    QSettings store("oc", "oc-client");
    store.setValue("provider", provider);
    store.setValue("baseUrl", baseUrl);
    store.setValue("apiKey", apiKey);
    store.setValue("model", model);
    store.setValue("port", static_cast<int>(port));
}

bool OcSettings::isCustomProvider() const {
    return !provider.isEmpty() && !kBuiltinProviders.contains(provider);
}

QString OcSettings::modelString() const {
    if (provider.isEmpty()) return model;
    if (model.isEmpty()) return QString();
    return provider + "/" + model;
}

QString OcSettings::configJson() const {
    const QString override = qEnvironmentVariable("OC_CONFIG_JSON");
    if (!override.isEmpty()) return override;

    QJsonObject config{
        {"permissions", QJsonArray{
            QJsonObject{{"action", "edit"}, {"resource", "*"}, {"effect", "ask"}},
            QJsonObject{{"action", "shell"}, {"resource", "*"}, {"effect", "ask"}},
        }},
    };

    if (!provider.isEmpty()) {
        QJsonObject settings;
        if (!baseUrl.isEmpty()) settings.insert("baseURL", baseUrl);
        if (!apiKey.isEmpty()) settings.insert("apiKey", apiKey);

        QJsonObject entry;
        if (!settings.isEmpty()) entry.insert("settings", settings);
        if (isCustomProvider()) {
            entry.insert("package", "aisdk:@ai-sdk/openai-compatible");
            if (!model.isEmpty()) entry.insert("models", QJsonObject{{model, QJsonObject{}}});
        }
        config.insert("providers", QJsonObject{{provider, entry}});
    }

    const QString model = modelString();
    if (!model.isEmpty()) config.insert("model", model);

    return QString::fromUtf8(QJsonDocument(config).toJson(QJsonDocument::Compact));
}
