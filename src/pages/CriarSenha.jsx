import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";

import "../styles/style.css";

export default function ResetarSenha() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const token = (searchParams.get("token") || hashParams.get("token") || "").trim();

    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");

    async function handleResetar(e) {
        e.preventDefault();

        setErro("");
        setMensagem("");

        if (!token) {
            setErro("Token inv�lido ou n�o encontrado. Solicite um novo link de recupera��o.");
            return;
        }

        if (!senha || !confirmarSenha) {
            setErro("Preencha todos os campos.");
            return;
        }

        if (senha.length < 6) {
            setErro("A senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (senha !== confirmarSenha) {
            setErro("As senhas não coincidem.");
            return;
        }

        try {
            setLoading(true);

            await api.post("/resetar", {
                token,
                novaSenha: senha,
            });

            setMensagem("Senha alterada com sucesso!");

            setSenha("");
            setConfirmarSenha("");

            setTimeout(() => {
                navigate("/login");
            }, 2000);

        } catch (error) {
            setErro(
                error.response?.data?.erro ||
                "Erro ao conectar com o servidor."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="recover-page">
            <section className="recover-left">
                <div className="recover-brand">
                    <div className="recover-logo">
                        P
                    </div>

                    <h1>POSTFAN</h1>
                </div>

                <div className="recover-left-content">
                    <h2>
                        Criar
                        <br />
                        nova senha
                    </h2>

                    <p>
                        Digite sua nova senha para acessar sua conta novamente.
                    </p>
                </div>
            </section>

            <section className="recover-right">
                <form
                    className="recover-card"
                    onSubmit={handleResetar}
                >
                    <h2>Nova senha</h2>

                    <p className="recover-subtitle">
                        Crie uma nova senha segura.
                    </p>

                    <label>Nova senha</label>

                    <input
                        type="password"
                        placeholder="Digite sua nova senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                    />

                    <label>Confirmar senha</label>

                    <input
                        type="password"
                        placeholder="Confirme sua nova senha"
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                    />

                    {erro && (
                        <div className="erro-msg">
                            {erro}
                        </div>
                    )}

                    {mensagem && (
                        <div className="success-msg">
                            {mensagem}
                        </div>
                    )}

                    <button
                        className="recover-submit"
                        disabled={loading}
                    >
                        {loading ? "Salvando..." : "Salvar nova senha"}
                    </button>
                </form>
            </section>
        </main>
    );
}
