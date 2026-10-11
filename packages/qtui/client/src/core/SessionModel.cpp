#include "SessionModel.h"

SessionModel::SessionModel(QObject *parent) : QObject(parent) {}

void SessionModel::reset() {
    m_parts.clear();
    m_order.clear();
    m_streamed.clear();
}

void SessionModel::upsert(const QJsonObject &part) {
    const QString id = part.value("id").toString();
    if (id.isEmpty()) return;

    Part entry;
    entry.id = id;
    entry.type = part.value("type").toString();
    if (entry.type == "text" || entry.type == "reasoning") {
        if (m_streamed.contains(id) && m_parts.contains(id)) {
            entry.text = m_parts.value(id).text;
        } else {
            entry.text = part.value("text").toString();
        }
    } else if (entry.type == "tool") {
        const QString tool = part.value("tool").toString();
        const QJsonObject state = part.value("state").toObject();
        entry.text = QString("[tool:%1 %2] %3").arg(tool, state.value("status").toString(),
                                                    state.value("title").toString());
    } else if (entry.type == "compaction") {
        entry.text = "[context compacted]";
    } else {
        entry.text = QString("[%1]").arg(entry.type);
    }

    if (!m_parts.contains(id)) m_order.append(id);
    m_parts.insert(id, entry);
}

void SessionModel::appendDelta(const QString &partID, const QString &field, const QString &delta) {
    if (field != "text" || !m_parts.contains(partID)) return;
    m_streamed.insert(partID);
    m_parts[partID].text += delta;
}

QString SessionModel::transcript() const {
    QStringList lines;
    for (const QString &id : m_order) {
        const Part &part = m_parts[id];
        if (part.text.isEmpty()) continue;
        lines.append(part.text);
    }
    return lines.join("\n\n");
}
