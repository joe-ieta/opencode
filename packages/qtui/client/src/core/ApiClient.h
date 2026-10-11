#pragma once

#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkRequest>
#include <QObject>
#include <QUrl>
#include <QUrlQuery>

#include <functional>

// Thin wrapper over the V2 `/api/*` HTTP surface. All endpoints are
// location-scoped through the `x-opencode-directory` header.
class ApiClient : public QObject {
    Q_OBJECT

public:
    using Callback = std::function<void(bool ok, const QJsonDocument &document, const QString &error)>;

    explicit ApiClient(QObject *parent = nullptr);

    void configure(const QUrl &baseUrl, const QString &password, const QString &directory);
    QUrl baseUrl() const { return m_baseUrl; }
    QByteArray authHeader() const;

    void get(const QString &path, Callback callback);
    void get(const QString &path, const QUrlQuery &query, Callback callback);
    void post(const QString &path, const QJsonObject &body, Callback callback);
    void postEmpty(const QString &path, Callback callback);
    void del(const QString &path, Callback callback);
    void del(const QString &path, const QUrlQuery &query, Callback callback);

    void fetchInfo(Callback callback);
    void fetchProviders(Callback callback);
    void fetchModels(Callback callback);
    void fetchModelDefault(Callback callback);
    void fetchConfig(Callback callback);
    void createSession(const QString &title, Callback callback);
    void fetchMessages(const QString &sessionID, Callback callback);
    void sendPrompt(const QString &sessionID, const QString &text, Callback callback);
    void interruptSession(const QString &sessionID, Callback callback);
    void replyPermission(const QString &sessionID, const QString &requestID, const QString &decision, Callback callback);
    void replyForm(const QString &sessionID, const QString &formID, const QJsonObject &answer, Callback callback);
    void cancelForm(const QString &sessionID, const QString &formID, const QString &message, Callback callback);

private:
    QNetworkRequest makeRequest(const QString &path, const QUrlQuery &query = QUrlQuery()) const;
    void send(QNetworkReply *reply, Callback callback);

    QNetworkAccessManager m_network;
    QUrl m_baseUrl;
    QString m_password;
    QString m_directory;
};
