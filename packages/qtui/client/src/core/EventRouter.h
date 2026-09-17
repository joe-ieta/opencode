#pragma once

#include <QJsonObject>
#include <QObject>
#include <QString>

class EventRouter : public QObject {
    Q_OBJECT

public:
    explicit EventRouter(QObject *parent = nullptr);

public slots:
    void handle(const QJsonObject &event);

signals:
    void partUpdated(const QJsonObject &part);
    void partDelta(const QString &partID, const QString &field, const QString &delta);
    void sessionIdle(const QString &sessionID);
    void sessionStatus(const QString &sessionID, const QString &status);
    void sessionError(const QString &sessionID, const QString &message);
    void permissionAsked(const QJsonObject &request);
    void permissionReplied(const QString &requestID);
    void questionAsked(const QJsonObject &request);
    void questionReplied(const QString &requestID);
    void unhandled(const QString &type);
};
