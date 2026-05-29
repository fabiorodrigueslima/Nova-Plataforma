import { useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import { NotificationContext } from "./notificationStore";

const dialogIcons = {
    success: FiCheckCircle,
    danger: FiAlertTriangle,
    warning: FiAlertTriangle,
    info: FiInfo,
};

export function NotificationProvider({ children }) {
    const [dialog, setDialog] = useState(null);

    function closeDialog(value) {
        if (dialog?.resolve) dialog.resolve(value);
        setDialog(null);
    }

    function openDialog(options) {
        return new Promise((resolve) => {
            setDialog({
                type: "info",
                confirmText: "Entendi",
                cancelText: "Cancelar",
                defaultValue: "",
                ...options,
                resolve,
            });
        });
    }

    const value = useMemo(
        () => ({
            notify: (options) => openDialog(options),
            confirm: (options) =>
                openDialog({
                    type: "warning",
                    confirmText: "Confirmar",
                    showCancel: true,
                    ...options,
                }),
            prompt: (options) =>
                openDialog({
                    type: "warning",
                    confirmText: "Enviar",
                    showCancel: true,
                    input: true,
                    ...options,
                }),
        }),
        [],
    );

    const Icon = dialog ? dialogIcons[dialog.type] || FiInfo : FiInfo;

    return (
        <NotificationContext.Provider value={value}>
            {children}

            {dialog && (
                <div className="app-dialog-overlay" role="dialog" aria-modal="true">
                    <div className={`app-dialog app-dialog-${dialog.type}`}>
                        <button
                            type="button"
                            className="app-dialog-close"
                            onClick={() => closeDialog(dialog.input ? null : false)}
                            aria-label="Fechar"
                        >
                            <FiX aria-hidden="true" />
                        </button>

                        <div className="app-dialog-icon">
                            <Icon aria-hidden="true" />
                        </div>

                        <div className="app-dialog-content">
                            <h2>{dialog.title || "PostFan"}</h2>
                            {dialog.message && <p>{dialog.message}</p>}

                            {dialog.input && (
                                <textarea
                                    className="app-dialog-input"
                                    defaultValue={dialog.defaultValue}
                                    placeholder={dialog.placeholder}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                            closeDialog(e.currentTarget.value);
                                        }
                                    }}
                                />
                            )}
                        </div>

                        <div className="app-dialog-actions">
                            {dialog.showCancel && (
                                <button
                                    type="button"
                                    className="app-dialog-secondary"
                                    onClick={() => closeDialog(null)}
                                >
                                    {dialog.cancelText || "Cancelar"}
                                </button>
                            )}

                            <button
                                type="button"
                                className="app-dialog-primary"
                                onClick={(e) => {
                                    const input = e.currentTarget
                                        .closest(".app-dialog")
                                        ?.querySelector(".app-dialog-input");

                                    closeDialog(input ? input.value : true);
                                }}
                            >
                                {dialog.confirmText || "Entendi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
}
