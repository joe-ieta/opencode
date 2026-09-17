#pragma once

#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkRequest>
#include <QObject>
#include <QUrl>

#include <functional>

class ApiClient : public QObject {
    Q_OBJECT

public:
    using Callback = std::function<void(bool ok, const QJsonDocument &document, const QString &error)>;

    explicit ApiClient(QObject *parent = nullptr);

    void configure(const QUrl &baseUrl, const QString &password, const QString &directory);
    QUrl baseUrl() const { return m_baseUrl; }
    QByteArray authHeader() const;

    void get(const QString &path, Callback callback);
    void post(const QString &path, const QJsonObject &body, Callback callback);
    void del(const QString &path, Callback callback);

private:
    QNetworkRequest makeRequest(const QString &path) const;
    void send(QNetworkReply *reply, Callback callback);

    QNetworkAccessManager m_network;
    QUrl m_baseUrl;
    QString m_password;
    QString m_directory;
};
