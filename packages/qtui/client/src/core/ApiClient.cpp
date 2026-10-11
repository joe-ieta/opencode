#include "ApiClient.h"

#include <QNetworkReply>

ApiClient::ApiClient(QObject *parent) : QObject(parent) {}

void ApiClient::configure(const QUrl &baseUrl, const QString &password, const QString &directory) {
    m_baseUrl = baseUrl;
    m_password = password;
    m_directory = directory;
}

QByteArray ApiClient::authHeader() const {
    return "Basic " + QByteArray("opencode:" + m_password.toUtf8()).toBase64();
}

QNetworkRequest ApiClient::makeRequest(const QString &path, const QUrlQuery &query) const {
    QUrl url = m_baseUrl;
    url.setPath(path);
    if (!query.isEmpty()) url.setQuery(query);
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", authHeader());
    request.setRawHeader("Content-Type", "application/json");
    if (!m_directory.isEmpty()) {
        request.setRawHeader("x-opencode-directory", QUrl::toPercentEncoding(m_directory));
    }
    return request;
}

void ApiClient::get(const QString &path, Callback callback) {
    get(path, QUrlQuery(), std::move(callback));
}

void ApiClient::get(const QString &path, const QUrlQuery &query, Callback callback) {
    send(m_network.get(makeRequest(path, query)), std::move(callback));
}

void ApiClient::post(const QString &path, const QJsonObject &body, Callback callback) {
    send(m_network.post(makeRequest(path), QJsonDocument(body).toJson(QJsonDocument::Compact)), std::move(callback));
}

void ApiClient::postEmpty(const QString &path, Callback callback) {
    send(m_network.post(makeRequest(path), QByteArray()), std::move(callback));
}

void ApiClient::del(const QString &path, Callback callback) {
    del(path, QUrlQuery(), std::move(callback));
}

void ApiClient::del(const QString &path, const QUrlQuery &query, Callback callback) {
    send(m_network.deleteResource(makeRequest(path, query)), std::move(callback));
}

void ApiClient::fetchInfo(Callback callback) {
    get("/api/info", std::move(callback));
}

void ApiClient::fetchProviders(Callback callback) {
    get("/api/provider", std::move(callback));
}

void ApiClient::fetchModels(Callback callback) {
    get("/api/model", std::move(callback));
}

void ApiClient::fetchModelDefault(Callback callback) {
    get("/api/model/default", std::move(callback));
}

void ApiClient::fetchConfig(Callback callback) {
    get("/api/config", std::move(callback));
}

void ApiClient::createSession(const QString &title, Callback callback) {
    post("/api/session", QJsonObject{{"title", title}}, std::move(callback));
}

void ApiClient::fetchMessages(const QString &sessionID, Callback callback) {
    QUrlQuery query;
    // Newest-first page; callers reverse it into chronological transcript order.
    query.addQueryItem("order", "desc");
    query.addQueryItem("limit", "200");
    get(QString("/api/session/%1/message").arg(sessionID), query, std::move(callback));
}

void ApiClient::sendPrompt(const QString &sessionID, const QString &text, Callback callback) {
    post(QString("/api/session/%1/prompt").arg(sessionID), QJsonObject{{"text", text}}, std::move(callback));
}

void ApiClient::interruptSession(const QString &sessionID, Callback callback) {
    postEmpty(QString("/api/session/%1/interrupt").arg(sessionID), std::move(callback));
}

void ApiClient::replyPermission(const QString &sessionID, const QString &requestID, const QString &decision,
                                Callback callback) {
    post(QString("/api/session/%1/permission/%2/reply").arg(sessionID, requestID),
         QJsonObject{{"decision", decision}}, std::move(callback));
}

void ApiClient::replyForm(const QString &sessionID, const QString &formID, const QJsonObject &answer,
                          Callback callback) {
    post(QString("/api/session/%1/form/%2/reply").arg(sessionID, formID), QJsonObject{{"answer", answer}},
         std::move(callback));
}

void ApiClient::cancelForm(const QString &sessionID, const QString &formID, const QString &message, Callback callback) {
    QUrlQuery query;
    if (!message.isEmpty()) query.addQueryItem("message", message);
    del(QString("/api/session/%1/form/%2").arg(sessionID, formID), query, std::move(callback));
}

void ApiClient::send(QNetworkReply *reply, Callback callback) {
    connect(reply, &QNetworkReply::finished, this, [reply, callback = std::move(callback)]() {
        const QByteArray payload = reply->readAll();
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const bool ok = reply->error() == QNetworkReply::NoError && status >= 200 && status < 300;
        const QJsonDocument document = QJsonDocument::fromJson(payload);
        const QString error = ok
            ? QString()
            : QString("%1 (HTTP %2) %3").arg(reply->errorString()).arg(status).arg(QString::fromUtf8(payload.left(300)));
        reply->deleteLater();
        if (callback) callback(ok, document, error);
    });
}
