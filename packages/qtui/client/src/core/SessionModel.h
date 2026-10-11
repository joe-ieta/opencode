#pragma once

#include <QHash>
#include <QJsonObject>
#include <QObject>
#include <QSet>
#include <QString>
#include <QStringList>

class SessionModel : public QObject {
    Q_OBJECT

public:
    explicit SessionModel(QObject *parent = nullptr);

    void reset();
    void upsert(const QJsonObject &part);
    void appendDelta(const QString &partID, const QString &field, const QString &delta);
    QString transcript() const;

private:
    struct Part {
        QString id;
        QString type;
        QString text;
    };

    QHash<QString, Part> m_parts;
    QStringList m_order;
    // Parts that already received incremental deltas; their full-text updates
    // must not overwrite the accumulated text (would duplicate content).
    QSet<QString> m_streamed;
};
