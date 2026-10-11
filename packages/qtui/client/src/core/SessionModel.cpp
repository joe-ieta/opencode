#include "SessionModel.h"

namespace {
QString blockKey(const QString &kind, const QString &suffix) {
    return kind + ":" + suffix;
}
}

SessionModel::SessionModel(QObject *parent) : QObject(parent) {}

void SessionModel::setSession(const QString &sessionID) {
    m_sessionID = sessionID;
    reset();
}

void SessionModel::reset() {
    m_entries.clear();
    m_order.clear();
}

bool SessionModel::matches(const QString &sessionID) const {
    return !m_sessionID.isEmpty() && sessionID == m_sessionID;
}

void SessionModel::applyMessages(const QJsonArray &messages) {
    reset();
    for (const QJsonValue &value : messages) applyMessage(value.toObject());
}

void SessionModel::applyMessage(const QJsonObject &message) {
    const QString id = message.value("id").toString();
    const QString type = message.value("type").toString();
    if (id.isEmpty()) return;

    Entry entry;
    entry.id = id;
    entry.type = type;

    if (type == "user" || type == "synthetic") {
        entry.text = message.value("text").toString();
    } else if (type == "system") {
        entry.text = message.value("description").toString();
        if (entry.text.isEmpty()) entry.text = message.value("text").toString();
    } else if (type == "skill") {
        entry.text = QString("[skill:%1]").arg(message.value("name").toString());
    } else if (type == "shell") {
        entry.text = QString("[shell:%1] %2")
                         .arg(message.value("status").toString(), message.value("command").toString());
    } else if (type == "compaction") {
        const QString status = message.value("status").toString();
        const QString summary = message.value("summary").toString();
        entry.text = summary.isEmpty() ? QString("[compaction:%1]").arg(status)
                                       : QString("[compaction:%1] %2").arg(status, summary);
    } else if (type == "assistant") {
        // Fetched content has no ordinal; array position keys the block.
        const QJsonArray content = message.value("content").toArray();
        for (int index = 0; index < content.size(); ++index) {
            const QJsonObject item = content.at(index).toObject();
            const QString itemType = item.value("type").toString();
            if (itemType == "text") {
                Block &block = ensureBlock(entry, blockKey("text", QString::number(index)), "text");
                block.text = item.value("text").toString();
            } else if (itemType == "reasoning") {
                Block &block = ensureBlock(entry, blockKey("reasoning", QString::number(index)), "reasoning");
                block.text = item.value("text").toString();
            } else if (itemType == "tool") {
                Block &block = ensureBlock(entry, blockKey("tool", item.value("id").toString()), "tool");
                block.name = item.value("name").toString();
                const QJsonObject state = item.value("state").toObject();
                block.status = state.value("status").toString();
                block.input = state.value("input").toObject();
                block.metadata = state.value("metadata").toObject();
                block.error = state.value("error").toObject().value("message").toString();
            }
        }
    } else {
        // agent-switched / model-switched / location-switched / idle are not rendered.
        return;
    }

    if (!m_entries.contains(id)) m_order.append(id);
    m_entries.insert(id, entry);
}

void SessionModel::addUserMessage(const QString &sessionID, const QString &messageID, const QString &text) {
    if (!matches(sessionID) || messageID.isEmpty()) return;
    Entry entry;
    entry.id = messageID;
    entry.type = "user";
    entry.text = text;
    if (!m_entries.contains(messageID)) m_order.append(messageID);
    m_entries.insert(messageID, entry);
}

SessionModel::Entry &SessionModel::ensureAssistant(const QString &assistantMessageID) {
    if (!m_entries.contains(assistantMessageID)) {
        Entry entry;
        entry.id = assistantMessageID;
        entry.type = "assistant";
        m_entries.insert(assistantMessageID, entry);
        m_order.append(assistantMessageID);
    }
    return m_entries[assistantMessageID];
}

SessionModel::Block &SessionModel::ensureBlock(Entry &entry, const QString &key, const QString &kind) {
    if (!entry.blocks.contains(key)) {
        Block block;
        block.kind = kind;
        entry.blocks.insert(key, block);
        entry.order.append(key);
    }
    return entry.blocks[key];
}

void SessionModel::textStarted(const QString &sessionID, const QString &assistantMessageID, int ordinal) {
    if (!matches(sessionID)) return;
    ensureBlock(ensureAssistant(assistantMessageID), blockKey("text", QString::number(ordinal)), "text");
}

void SessionModel::textDelta(const QString &sessionID, const QString &assistantMessageID, int ordinal,
                             const QString &delta) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("text", QString::number(ordinal)), "text");
    block.text += delta;
}

void SessionModel::textEnded(const QString &sessionID, const QString &assistantMessageID, int ordinal,
                             const QString &text) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("text", QString::number(ordinal)), "text");
    block.text = text;
}

void SessionModel::reasoningStarted(const QString &sessionID, const QString &assistantMessageID, int ordinal) {
    if (!matches(sessionID)) return;
    ensureBlock(ensureAssistant(assistantMessageID), blockKey("reasoning", QString::number(ordinal)), "reasoning");
}

void SessionModel::reasoningDelta(const QString &sessionID, const QString &assistantMessageID, int ordinal,
                                  const QString &delta) {
    if (!matches(sessionID)) return;
    Block &block =
        ensureBlock(ensureAssistant(assistantMessageID), blockKey("reasoning", QString::number(ordinal)), "reasoning");
    block.text += delta;
}

void SessionModel::reasoningEnded(const QString &sessionID, const QString &assistantMessageID, int ordinal,
                                  const QString &text) {
    if (!matches(sessionID)) return;
    Block &block =
        ensureBlock(ensureAssistant(assistantMessageID), blockKey("reasoning", QString::number(ordinal)), "reasoning");
    block.text = text;
}

void SessionModel::toolInputStarted(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                                    const QString &name) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.name = name;
    block.status = "streaming";
}

void SessionModel::toolInputDelta(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                                  const QString &delta) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    if (block.status.isEmpty()) block.status = "streaming";
    block.text += delta;
}

void SessionModel::toolInputEnded(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                                  const QString &text) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.text = text;
}

void SessionModel::toolCalled(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                              const QJsonObject &input) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.status = "running";
    block.input = input;
}

void SessionModel::toolProgress(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                                const QJsonObject &metadata) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.metadata = metadata;
}

void SessionModel::toolSucceeded(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                                 const QJsonObject &metadata) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.status = "completed";
    block.metadata = metadata;
}

void SessionModel::toolFailed(const QString &sessionID, const QString &assistantMessageID, const QString &toolID,
                              const QString &message) {
    if (!matches(sessionID)) return;
    Block &block = ensureBlock(ensureAssistant(assistantMessageID), blockKey("tool", toolID), "tool");
    block.status = "error";
    block.error = message;
}

QString SessionModel::transcript() const {
    QStringList lines;
    for (const QString &id : m_order) {
        const Entry entry = m_entries.value(id);
        if (entry.type != "assistant") {
            if (!entry.text.isEmpty()) lines.append(entry.text);
            continue;
        }
        QStringList blocks;
        for (const QString &key : entry.order) {
            const Block block = entry.blocks.value(key);
            if (block.kind == "text") {
                if (!block.text.isEmpty()) blocks.append(block.text);
            } else if (block.kind == "reasoning") {
                if (!block.text.isEmpty()) blocks.append("[reasoning] " + block.text);
            } else if (block.kind == "tool") {
                QString line = QString("[tool:%1 %2]").arg(block.name, block.status);
                if (!block.error.isEmpty()) line += ": " + block.error;
                blocks.append(line);
            }
        }
        if (!blocks.isEmpty()) lines.append(blocks.join("\n"));
    }
    return lines.join("\n\n");
}
