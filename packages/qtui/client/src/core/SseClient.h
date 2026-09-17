#pragma once

#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QObject>
#include <QUrl>

#include "SseParser.h"

class SseClient : public QObject {
    Q_OBJECT

public:
    explicit SseClient(QObject *parent = nullptr);

    void open(const QUrl &url, const QByteArray &authorization, const QString &directory = QString());
    void close();
    bool isOpen() const { return m_reply != nullptr; }

signals:
    void opened();
    void eventReceived(const QJsonObject &event);
    void failed(const QString &message);

private:
    void onReadyRead();
    void onFinished();

    QNetworkAccessManager m_network;
    QNetworkReply *m_reply = nullptr;
    SseParser m_parser;
    bool m_opened = false;
};
