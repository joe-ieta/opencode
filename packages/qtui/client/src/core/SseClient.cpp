#include "SseClient.h"

#include <QNetworkRequest>

SseClient::SseClient(QObject *parent) : QObject(parent) {}

void SseClient::open(const QUrl &url, const QByteArray &authorization, const QString &directory) {
    close();

    QNetworkRequest request(url);
    request.setRawHeader("Authorization", authorization);
    request.setRawHeader("Accept", "text/event-stream");
    request.setRawHeader("Cache-Control", "no-cache");
    // Events are scoped to the request directory; without it the stream only
    // receives server-level events (connected/heartbeat).
    if (!directory.isEmpty()) {
        request.setRawHeader("x-opencode-directory", QUrl::toPercentEncoding(directory));
    }
#if QT_VERSION >= QT_VERSION_CHECK(6, 7, 0)
    // Qt 6.7 enables a 30s transfer timeout by default, which would kill the
    // long-lived event stream.
    request.setTransferTimeout(0);
#endif

    m_parser.reset();
    m_opened = false;
    m_reply = m_network.get(request);
    connect(m_reply, &QNetworkReply::readyRead, this, &SseClient::onReadyRead);
    connect(m_reply, &QNetworkReply::finished, this, &SseClient::onFinished);
}

void SseClient::close() {
    if (!m_reply) return;
    m_reply->disconnect(this);
    m_reply->abort();
    m_reply->deleteLater();
    m_reply = nullptr;
}

void SseClient::onReadyRead() {
    if (!m_reply) return;
    if (!m_opened) {
        m_opened = true;
        emit opened();
    }
    const QList<QJsonObject> events = m_parser.feed(m_reply->readAll());
    for (const QJsonObject &event : events) emit eventReceived(event);
}

void SseClient::onFinished() {
    if (!m_reply) return;
    const bool canceled = m_reply->error() == QNetworkReply::OperationCanceledError;
    const QString error = canceled ? QString() : m_reply->errorString();
    m_reply->deleteLater();
    m_reply = nullptr;
    m_opened = false;
    if (!error.isEmpty()) emit failed(error);
}
