#pragma once

#include <QString>

// Runtime parameters for the embedded oc_core server.
// Persisted with QSettings; environment variables are used as fallback.
struct OcSettings {
    QString provider;   // LLM type, e.g. "anthropic", "openai", or a custom id
    QString baseUrl;    // optional provider base URL override
    QString apiKey;     // optional API key (written into the kernel config)
    QString model;      // model id, e.g. "claude-sonnet-4-5"
    quint16 port = 0;   // 0 = random port

    static OcSettings load();
    void save() const;

    bool isCustomProvider() const;
    QString modelString() const;  // "provider/model" when both are set
    QString configJson() const;   // OPENCODE_CONFIG_CONTENT payload
};
