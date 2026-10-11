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

QNetworkRequest ApiClient::makeRequest(const QString &path) const {
    QUrl url = m_baseUrl;
    url.setPath(path);
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", authHeader());
    request.setRawHeader("Content-Type", "application/json");
    if (!m_directory.isEmpty()) {
        request.setRawHeader("x-opencode-directory", QUrl::toPercentEncoding(m_directory));
    }
    return request;
}

void ApiClient::get(const QString &path, Callback callback) {
    send(m_network.get(makeRequest(path)), std::move(callback));
}

void ApiClient::post(const QString &path, const QJsonObject &body, Callback callback) {
    send(m_network.post(makeRequest(path), QJsonDocument(body).toJson(QJsonDocument::Compact)), std::move(callback));
}

void ApiClient::del(const QString &path, Callback callback) {
    send(m_network.deleteResource(makeRequest(path)), std::move(callback));
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
