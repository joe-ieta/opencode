#pragma once

#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QString>
#include <QStringList>

// V2 projection of one session transcript. Full rebuilds come from
// `GET /api/session/{id}/message`; live `session.text|reasoning|tool.*` events
// stream into the same structure. Methods ignore events for other sessions.
class SessionModel : public QObject {
    Q_OBJECT

public:
    explicit SessionModel(QObject *parent = nullptr);

    void setSession(const QString &sessionID);
    void reset();
    void applyMessages(const QJsonArray &messages);
    void addUserMessage(const QString &sessionID, const QString &messageID, const QString &text);

    void textStarted(const QString &sessionID, const QString &assistantMessageID, int ordinal);
    void textDelta(const QString &sessionID, const QString &assistantMessageID, int ordinal, const QString &delta);
    void textEnded(const QString &sessionID, const QString &assistantMessageID, int ordinal, const QString &text);
    void reasoningStarted(const QString &sessionID, const QString &assistantMessageID, int ordinal);
    void reasoningDelta(const QString &sessionID, const QString &assistantMessageID, int ordinal, const QString &delta);
    void reasoningEnded(const QString &sessionID, const QString &assistantMessageID, int ordinal, const QString &text);
    void toolInputStarted(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                          const QString &name);
    void toolInputDelta(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                        const QString &delta);
    void toolInputEnded(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                        const QString &text);
    void toolCalled(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                    const QJsonObject &input);
    void toolProgress(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                      const QJsonObject &metadata);
    void toolSucceeded(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                       const QJsonObject &metadata);
    void toolFailed(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                    const QString &message);

    QString transcript() const;

private:
    struct Block {
        QString kind;  // "text" | "reasoning" | "tool"
        QString text;
        QString name;
        QString status;
        QString error;
        QJsonObject input;
        QJsonObject metadata;
    };

    struct Entry {
        QString id;
        QString type;
        QString text;
        QStringList order;
        QHash<QString, Block> blocks;
    };

    bool matches(const QString &sessionID) const;
    Entry &ensureAssistant(const QString &assistantMessageID);
    Block &ensureBlock(Entry &entry, const QString &key, const QString &kind);
    void applyMessage(const QJsonObject &message);

    QString m_sessionID;
    QHash<QString, Entry> m_entries;
    QStringList m_order;
};
