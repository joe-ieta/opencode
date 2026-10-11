#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QList>

// Minimal SSE frame parser: buffers arbitrary byte chunks and yields complete
// JSON events. Ignores comments (heartbeats) and non-data fields.
class SseParser {
public:
    QList<QJsonObject> feed(const QByteArray &chunk);
    void reset();

private:
    QByteArray m_buffer;
};
