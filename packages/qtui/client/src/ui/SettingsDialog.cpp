#include "SettingsDialog.h"

#include <QCheckBox>
#include <QComboBox>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QSpinBox>
#include <QVBoxLayout>

SettingsDialog::SettingsDialog(const QtocSettings &current, QWidget *parent) : QDialog(parent) {
    setWindowTitle("qtoc_core runtime settings");

    m_provider = new QComboBox(this);
    m_provider->setEditable(true);
    m_provider->addItems({"anthropic", "openai", "google", "openrouter", "openai-compatible", "custom"});
    m_provider->setCurrentText(current.provider);
    m_provider->setToolTip("LLM provider id. Built-in ids are used as-is; other ids are registered as a custom\n"
                           "OpenAI-compatible provider (npm: @ai-sdk/openai-compatible).");

    m_baseUrl = new QLineEdit(current.baseUrl, this);
    m_baseUrl->setPlaceholderText("可选，例如 https://api.example.com/v1");

    m_apiKey = new QLineEdit(current.apiKey, this);
    m_apiKey->setEchoMode(QLineEdit::Password);
    m_apiKey->setPlaceholderText("API Key（写入内核 provider options）");

    auto *showKey = new QCheckBox("显示", this);
    connect(showKey, &QCheckBox::toggled, this, [this](bool shown) {
        m_apiKey->setEchoMode(shown ? QLineEdit::Normal : QLineEdit::Password);
    });

    m_model = new QLineEdit(current.model, this);
    m_model->setPlaceholderText("例如 claude-sonnet-4-5 / gpt-5");

    m_port = new QSpinBox(this);
    m_port->setRange(0, 65535);
    m_port->setSpecialValueText("随机");
    m_port->setValue(current.port);
    m_port->setToolTip("内核 HTTP 服务端口，0 表示随机端口。");

    auto *apiRow = new QWidget(this);
    auto *apiLayout = new QHBoxLayout(apiRow);
    apiLayout->setContentsMargins(0, 0, 0, 0);
    apiLayout->addWidget(m_apiKey, 1);
    apiLayout->addWidget(showKey);

    auto *form = new QFormLayout;
    form->addRow("LLM 类型", m_provider);
    form->addRow("基础 URL", m_baseUrl);
    form->addRow("API Key", apiRow);
    form->addRow("模型名称", m_model);
    form->addRow("服务端口", m_port);

    auto *hint = new QLabel(
        "模型最终以 provider/model 形式写入内核配置；留空则沿用上次会话的模型。\n"
        "凭据仅保存在本机（QSettings）并注入内核进程，不会写入仓库。",
        this);
    hint->setWordWrap(true);
    hint->setStyleSheet("color: palette(mid);");

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    connect(buttons, &QDialogButtonBox::accepted, this, &SettingsDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &SettingsDialog::reject);

    auto *layout = new QVBoxLayout(this);
    layout->addLayout(form);
    layout->addWidget(hint);
    layout->addWidget(buttons);
    resize(520, sizeHint().height());
}

QtocSettings SettingsDialog::settings() const {
    QtocSettings result;
    result.provider = m_provider->currentText().trimmed();
    result.baseUrl = m_baseUrl->text().trimmed();
    result.apiKey = m_apiKey->text().trimmed();
    result.model = m_model->text().trimmed();
    result.port = static_cast<quint16>(m_port->value());
    return result;
}
