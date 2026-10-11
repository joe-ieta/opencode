#pragma once

#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QString>

// Parses the V2 `/api/event` envelope ({ id, type, data, ... }) and maps the
// subset the client consumes onto semantic signals. Unknown event types are
// reported through `unhandled` and otherwise ignored.
class EventRouter : public QObject {
    Q_OBJECT

public:
    explicit EventRouter(QObject *parent = nullptr);

public slots:
    void handle(const QJsonObject &event);

signals:
    void textStarted(const QString &sessionID, const QString &messageID, int ordinal);
    void textDelta(const QString &sessionID, const QString &messageID, int ordinal, const QString &delta);
    void textEnded(const QString &sessionID, const QString &messageID, int ordinal, const QString &text);
    void reasoningStarted(const QString &sessionID, const QString &messageID, int ordinal);
    void reasoningDelta(const QString &sessionID, const QString &messageID, int ordinal, const QString &delta);
    void reasoningEnded(const QString &sessionID, const QString &messageID, int ordinal, const QString &text);
    void toolInputStarted(const QString &sessionID, const QString &messageID, const QString &toolID,
                          const QString &name);
    void toolInputDelta(const QString &sessionID, const QString &messageID, const QString &toolID,
                        const QString &delta);
    void toolInputEnded(const QString &sessionID, const QString &messageID, const QString &toolID,
                        const QString &text);
    void toolCalled(const QString &sessionID, const QString &messageID, const QString &toolID,
                    const QJsonObject &input);
    void toolProgress(const QString &sessionID, const QString &messageID, const QString &toolID,
                      const QJsonObject &metadata);
    void toolSucceeded(const QString &sessionID, const QString &messageID, const QString &toolID,
                       const QJsonArray &content, const QJsonObject &metadata);
    void toolFailed(const QString &sessionID, const QString &messageID, const QString &toolID,
                    const QString &message);
    void sessionIdle(const QString &sessionID);
    void sessionStatus(const QString &sessionID, const QString &status);
    void sessionRetry(const QString &sessionID, int attempt, const QString &message);
    void sessionError(const QString &sessionID, const QString &message);
    void executionEnded(const QString &sessionID, const QString &outcome);
    void permissionAsked(const QJsonObject &request);
    void permissionReplied(const QString &requestID);
    void formCreated(const QJsonObject &form);
    void formReplied(const QString &formID);
    void formCancelled(const QString &formID);
    void unhandled(const QString &type);
};
