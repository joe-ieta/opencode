#include "EventRouter.h"

#include <QJsonDocument>
#include <QJsonValue>

namespace {
// V2 errors are SessionError.Error shapes ({ type, message, status?, response? });
// fall back to the raw JSON so the UI never shows an empty message.
QString errorText(const QJsonValue &value) {
    if (value.isString()) return value.toString();
    const QJsonObject object = value.toObject();
    if (object.isEmpty()) return QString();
    const QString message = object.value("message").toString();
    if (!message.isEmpty()) {
        const QString type = object.value("type").toString();
        return type.isEmpty() ? message : QString("%1: %2").arg(type, message);
    }
    return QString::fromUtf8(QJsonDocument(object).toJson(QJsonDocument::Compact));
}
}

EventRouter::EventRouter(QObject *parent) : QObject(parent) {}

void EventRouter::handle(const QJsonObject &event) {
    const QString type = event.value("type").toString();
    const QJsonObject data = event.value("data").toObject();
    const QString sessionID = data.value("sessionID").toString();
    const QString messageID = data.value("assistantMessageID").toString();

    if (type == "session.text.started") {
        emit textStarted(sessionID, messageID, data.value("ordinal").toInt());
    } else if (type == "session.text.delta") {
        emit textDelta(sessionID, messageID, data.value("ordinal").toInt(), data.value("delta").toString());
    } else if (type == "session.text.ended") {
        emit textEnded(sessionID, messageID, data.value("ordinal").toInt(), data.value("text").toString());
    } else if (type == "session.reasoning.started") {
        emit reasoningStarted(sessionID, messageID, data.value("ordinal").toInt());
    } else if (type == "session.reasoning.delta") {
        emit reasoningDelta(sessionID, messageID, data.value("ordinal").toInt(), data.value("delta").toString());
    } else if (type == "session.reasoning.ended") {
        emit reasoningEnded(sessionID, messageID, data.value("ordinal").toInt(), data.value("text").toString());
    } else if (type == "session.tool.input.started") {
        emit toolInputStarted(sessionID, messageID, data.value("id").toString(), data.value("name").toString());
    } else if (type == "session.tool.input.delta") {
        emit toolInputDelta(sessionID, messageID, data.value("id").toString(), data.value("delta").toString());
    } else if (type == "session.tool.input.ended") {
        emit toolInputEnded(sessionID, messageID, data.value("id").toString(), data.value("text").toString());
    } else if (type == "session.tool.called") {
        emit toolCalled(sessionID, messageID, data.value("id").toString(), data.value("input").toObject());
    } else if (type == "session.tool.progress") {
        emit toolProgress(sessionID, messageID, data.value("id").toString(), data.value("metadata").toObject());
    } else if (type == "session.tool.success") {
        emit toolSucceeded(sessionID, messageID, data.value("id").toString(), data.value("content").toArray(),
                           data.value("metadata").toObject());
    } else if (type == "session.tool.failed") {
        emit toolFailed(sessionID, messageID, data.value("id").toString(), errorText(data.value("error")));
    } else if (type == "session.idle") {
        emit sessionIdle(sessionID);
    } else if (type == "session.status") {
        emit sessionStatus(sessionID, data.value("status").toObject().value("type").toString());
    } else if (type == "session.retry.scheduled") {
        emit sessionRetry(sessionID, data.value("attempt").toInt(), errorText(data.value("error")));
    } else if (type == "session.execution.succeeded") {
        emit executionEnded(sessionID, "succeeded");
    } else if (type == "session.execution.failed") {
        emit sessionError(sessionID, errorText(data.value("error")));
        emit executionEnded(sessionID, "failed");
    } else if (type == "session.execution.interrupted") {
        emit executionEnded(sessionID, "interrupted");
    } else if (type == "permission.asked") {
        emit permissionAsked(data);
    } else if (type == "permission.replied") {
        emit permissionReplied(data.value("requestID").toString());
    } else if (type == "form.created") {
        emit formCreated(data.value("form").toObject());
    } else if (type == "form.replied") {
        emit formReplied(data.value("id").toString());
    } else if (type == "form.cancelled") {
        emit formCancelled(data.value("id").toString());
    } else {
        emit unhandled(type);
    }
}
