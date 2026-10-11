#include "FormDialog.h"

#include <QCheckBox>
#include <QComboBox>
#include <QDialogButtonBox>
#include <QDoubleValidator>
#include <QFormLayout>
#include <QIntValidator>
#include <QLineEdit>
#include <QMessageBox>
#include <QSet>
#include <QVBoxLayout>
#include <QVariant>

#include <climits>

FormDialog::FormDialog(const QJsonObject &form, QWidget *parent) : QDialog(parent) {
    const QString title = form.value("title").toString();
    setWindowTitle(title.isEmpty() ? QString("Form") : title);

    m_layout = new QFormLayout;

    for (const QJsonValue &value : form.value("fields").toArray()) buildField(value.toObject());
    updateVisibility();

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    connect(buttons, &QDialogButtonBox::accepted, this, &FormDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &FormDialog::reject);

    auto *layout = new QVBoxLayout(this);
    layout->addLayout(m_layout);
    layout->addWidget(buttons);
    resize(520, sizeHint().height());
}

void FormDialog::buildField(const QJsonObject &spec) {
    Field field;
    field.key = spec.value("key").toString();
    field.title = spec.value("title").toString();
    field.type = spec.value("type").toString();
    field.custom = spec.value("custom").toBool();
    field.required = spec.value("required").toBool();
    field.when = spec.value("when").toArray();
    if (field.key.isEmpty() || field.type == "external") return;
    if (field.title.isEmpty()) field.title = field.key;

    if (spec.value("hidden").toBool()) {
        if (spec.contains("default")) m_hiddenDefaults.insert(field.key, spec.value("default"));
        return;
    }

    if (field.type == "string") {
        const QJsonArray options = spec.value("options").toArray();
        if (!options.isEmpty()) {
            auto *combo = new QComboBox(this);
            for (const QJsonValue &value : options) {
                const QJsonObject option = value.toObject();
                combo->addItem(option.value("label").toString(), option.value("value").toString());
            }
            combo->setEditable(field.custom);
            const QJsonValue fallback = spec.value("default");
            if (!fallback.isUndefined()) {
                const int index = combo->findData(fallback.toString());
                if (index >= 0) combo->setCurrentIndex(index);
                else if (field.custom) combo->setCurrentText(fallback.toString());
            } else if (!field.custom) {
                combo->setCurrentIndex(-1);
            }
            connect(combo, &QComboBox::currentTextChanged, this, &FormDialog::updateVisibility);
            field.combo = combo;
            field.editor = combo;
        } else {
            auto *line = new QLineEdit(spec.value("default").toString(), this);
            line->setPlaceholderText(spec.value("placeholder").toString());
            connect(line, &QLineEdit::textChanged, this, &FormDialog::updateVisibility);
            field.lineEdit = line;
            field.editor = line;
        }
    } else if (field.type == "number" || field.type == "integer") {
        auto *line = new QLineEdit(this);
        if (spec.contains("default")) line->setText(QString::number(spec.value("default").toDouble(), 'g', 15));
        if (field.type == "integer") {
            const int bottom = spec.contains("minimum") ? static_cast<int>(spec.value("minimum").toDouble()) : INT_MIN;
            const int top = spec.contains("maximum") ? static_cast<int>(spec.value("maximum").toDouble()) : INT_MAX;
            line->setValidator(new QIntValidator(bottom, top, line));
        } else {
            auto *validator = new QDoubleValidator(line);
            validator->setNotation(QDoubleValidator::StandardNotation);
            if (spec.contains("minimum")) validator->setBottom(spec.value("minimum").toDouble());
            if (spec.contains("maximum")) validator->setTop(spec.value("maximum").toDouble());
            line->setValidator(validator);
        }
        connect(line, &QLineEdit::textChanged, this, &FormDialog::updateVisibility);
        field.lineEdit = line;
        field.editor = line;
    } else if (field.type == "boolean") {
        auto *check = new QCheckBox(this);
        check->setChecked(spec.value("default").toBool());
        connect(check, &QCheckBox::toggled, this, &FormDialog::updateVisibility);
        field.checkBox = check;
        field.editor = check;
    } else if (field.type == "multiselect") {
        auto *container = new QWidget(this);
        auto *column = new QVBoxLayout(container);
        column->setContentsMargins(0, 0, 0, 0);
        QSet<QString> defaults;
        for (const QJsonValue &value : spec.value("default").toArray()) defaults.insert(value.toString());
        for (const QJsonValue &value : spec.value("options").toArray()) {
            const QJsonObject option = value.toObject();
            const QString optionValue = option.value("value").toString();
            auto *check = new QCheckBox(option.value("label").toString(), container);
            check->setChecked(defaults.contains(optionValue));
            connect(check, &QCheckBox::toggled, this, &FormDialog::updateVisibility);
            column->addWidget(check);
            field.optionChecks.append(check);
            field.optionValues.append(optionValue);
        }
        if (field.custom) {
            field.customEdit = new QLineEdit(container);
            field.customEdit->setPlaceholderText("其他答案（可留空）");
            connect(field.customEdit, &QLineEdit::textChanged, this, &FormDialog::updateVisibility);
            column->addWidget(field.customEdit);
        }
        field.editor = container;
    } else {
        return;
    }

    m_layout->addRow(field.title, field.editor);
    m_fields.append(field);
}

void FormDialog::updateVisibility() {
    for (const Field &field : m_fields) m_layout->setRowVisible(field.editor, fieldActive(field));
}

bool FormDialog::fieldActive(const Field &field) const {
    for (const QJsonValue &value : field.when) {
        if (!whenHolds(value.toObject())) return false;
    }
    return true;
}

bool FormDialog::whenHolds(const QJsonObject &condition) const {
    const QJsonValue actual = answerValue(condition.value("key").toString());
    if (actual.isUndefined()) return false;
    const QJsonValue expected = condition.value("value");
    bool equal = false;
    if (actual.isArray()) {
        for (const QJsonValue &item : actual.toArray()) {
            if (item == expected) {
                equal = true;
                break;
            }
        }
    } else {
        equal = actual == expected;
    }
    return condition.value("op").toString() == "neq" ? !equal : equal;
}

QJsonValue FormDialog::answerValue(const QString &key) const {
    for (const Field &field : m_fields) {
        if (field.key != key) continue;
        if (!fieldActive(field)) return QJsonValue(QJsonValue::Undefined);
        return fieldValue(field);
    }
    return QJsonValue(QJsonValue::Undefined);
}

QJsonValue FormDialog::fieldValue(const Field &field) const {
    if (field.type == "boolean") return QJsonValue(field.checkBox && field.checkBox->isChecked());
    if (field.type == "number" || field.type == "integer") {
        if (!field.lineEdit) return QJsonValue(QJsonValue::Undefined);
        const QString text = field.lineEdit->text().trimmed();
        if (text.isEmpty()) return QJsonValue(QJsonValue::Undefined);
        bool ok = false;
        const double value = text.toDouble(&ok);
        if (!ok) return QJsonValue(QJsonValue::Undefined);
        return field.type == "integer" ? QJsonValue(static_cast<qint64>(value)) : QJsonValue(value);
    }
    if (field.type == "multiselect") {
        QJsonArray values;
        for (int index = 0; index < field.optionChecks.size(); ++index) {
            if (field.optionChecks.at(index)->isChecked()) values.append(field.optionValues.value(index));
        }
        if (field.customEdit) {
            const QString custom = field.customEdit->text().trimmed();
            if (!custom.isEmpty()) values.append(custom);
        }
        if (values.isEmpty()) return QJsonValue(QJsonValue::Undefined);
        return QJsonValue(values);
    }
    if (field.combo) {
        const QVariant data = field.combo->currentData();
        if (data.isValid() && !data.toString().isEmpty()) return QJsonValue(data.toString());
        const QString text = field.combo->currentText().trimmed();
        return text.isEmpty() ? QJsonValue(QJsonValue::Undefined) : QJsonValue(text);
    }
    if (field.lineEdit) {
        const QString text = field.lineEdit->text().trimmed();
        return text.isEmpty() ? QJsonValue(QJsonValue::Undefined) : QJsonValue(text);
    }
    return QJsonValue(QJsonValue::Undefined);
}

QJsonObject FormDialog::answer() const {
    QJsonObject result = m_hiddenDefaults;
    for (const Field &field : m_fields) {
        if (!fieldActive(field)) continue;
        const QJsonValue value = fieldValue(field);
        if (value.isUndefined()) continue;
        result.insert(field.key, value);
    }
    return result;
}

void FormDialog::accept() {
    for (const Field &field : m_fields) {
        if (!fieldActive(field)) continue;
        if (field.required && fieldValue(field).isUndefined()) {
            QMessageBox::warning(this, "Form", QString("必填字段未填写: %1").arg(field.title));
            return;
        }
    }
    QDialog::accept();
}
