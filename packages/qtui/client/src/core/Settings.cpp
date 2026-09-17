#include "Settings.h"

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

QtocSettings QtocSettings::load() {
    QSettings store("qtoc", "qtoc-client");
    QtocSettings settings;
    settings.provider = firstNonEmpty(store.value("provider").toString(), qEnvironmentVariable("QTOC_PROVIDER"));
    settings.baseUrl = firstNonEmpty(store.value("baseUrl").toString(), qEnvironmentVariable("QTOC_BASE_URL"));
    settings.apiKey = firstNonEmpty(store.value("apiKey").toString(), qEnvironmentVariable("QTOC_API_KEY"));
    settings.model = firstNonEmpty(store.value("model").toString(), qEnvironmentVariable("QTOC_MODEL"));
    const int port = store.value("port", qEnvironmentVariableIntValue("QTOC_PORT")).toInt();
    settings.port = static_cast<quint16>(qBound(0, port, 65535));
    return settings;
}

void QtocSettings::save() const {
    QSettings store("qtoc", "qtoc-client");
    store.setValue("provider", provider);
    store.setValue("baseUrl", baseUrl);
    store.setValue("apiKey", apiKey);
    store.setValue("model", model);
    store.setValue("port", static_cast<int>(port));
}

bool QtocSettings::isCustomProvider() const {
    return !provider.isEmpty() && !kBuiltinProviders.contains(provider);
}

QString QtocSettings::modelString() const {
    if (provider.isEmpty()) return model;
    if (model.isEmpty()) return QString();
    return provider + "/" + model;
}

QString QtocSettings::configJson() const {
    const QString override = qEnvironmentVariable("QTOC_CONFIG_JSON");
    if (!override.isEmpty()) return override;

    QJsonObject config{
        {"permission", QJsonObject{{"edit", "ask"}, {"bash", "ask"}}},
    };

    if (!provider.isEmpty()) {
        QJsonObject options;
        if (!baseUrl.isEmpty()) options.insert("baseURL", baseUrl);
        if (!apiKey.isEmpty()) options.insert("apiKey", apiKey);

        QJsonObject entry;
        if (!options.isEmpty()) entry.insert("options", options);
        if (isCustomProvider()) {
            entry.insert("npm", "@ai-sdk/openai-compatible");
            if (!model.isEmpty()) entry.insert("models", QJsonObject{{model, QJsonObject{}}});
        }
        config.insert("provider", QJsonObject{{provider, entry}});
    }

    const QString model = modelString();
    if (!model.isEmpty()) config.insert("model", model);

    return QString::fromUtf8(QJsonDocument(config).toJson(QJsonDocument::Compact));
}
