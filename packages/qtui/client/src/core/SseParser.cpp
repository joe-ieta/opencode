#include "SseParser.h"

#include <QJsonDocument>

namespace {
constexpr int kMaxBuffer = 1024 * 1024;
}

QList<QJsonObject> SseParser::feed(const QByteArray &chunk) {
    QList<QJsonObject> events;
    m_buffer.append(chunk);
    if (m_buffer.size() > kMaxBuffer) {
        m_buffer.clear();
        return events;
    }

    // Normalize line endings without losing a trailing CR that belongs to the
    // next chunk (mirrors the reference parser in the opencode client).
    const bool trailingCr = m_buffer.endsWith('\r');
    if (trailingCr) m_buffer.chop(1);
    m_buffer.replace("\r\n", "\n");
    m_buffer.replace('\r', '\n');
    if (trailingCr) m_buffer.append('\r');

    int index = -1;
    while ((index = m_buffer.indexOf("\n\n")) >= 0) {
        const QByteArray block = m_buffer.left(index);
        m_buffer.remove(0, index + 2);

        QByteArray data;
        const QList<QByteArray> lines = block.split('\n');
        for (const QByteArray &line : lines) {
            if (!line.startsWith("data:")) continue;
            if (!data.isEmpty()) data.append('\n');
            data.append(line.mid(5).trimmed());
        }
        if (data.isEmpty()) continue;

        const QJsonDocument document = QJsonDocument::fromJson(data);
        if (document.isObject()) events.append(document.object());
    }
    return events;
}

void SseParser::reset() {
    m_buffer.clear();
}
