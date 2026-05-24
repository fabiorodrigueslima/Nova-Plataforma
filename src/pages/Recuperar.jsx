import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/style.css";

export default function Recuperar() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");

    async function handleRecuperar(e) {
        e.preventDefault();

        setErro("");
        setMensagem("");

        if (!email) {
            setErro("Digite seu email.");
            return;
        }

        try {
            setLoading(true);

            await api.post(
                "/recuperar",
                { email },
                { timeout: 60000 },
            );

            setMensagem(
                "Enviamos um link de recuperação para seu email. Use o link mais recente e verifique também a caixa de spam.",
            );
            setEmail("");
        } catch (error) {
            if (error.code === "ECONNABORTED") {
                setErro("O servidor demorou para responder. Tente novamente em alguns minutos.");
                return;
            }

            setErro(error.response?.data?.erro || "Erro ao recuperar senha.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="recover-page">
            <section className="recover-left">
                <div className="recover-brand">
                    <div className="recover-logo">P</div>
                    <h1>POSTFAN</h1>
                </div>

                <div className="recover-left-content">
                    <h2>
                        Recuperar
                        <br />
                        sua senha
                    </h2>

                    <p>Informe seu email para receber um link de recuperação da sua conta.</p>
                </div>
            </section>

            <section className="recover-right">
                <form className="recover-card" onSubmit={handleRecuperar}>
                    <h2>Esqueci minha senha</h2>

                    <p className="recover-subtitle">Digite o email da sua conta.</p>

                    <label>E-mail</label>
                    <input
                        type="email"
                        placeholder="Digite seu email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    {erro && <div className="erro-msg">{erro}</div>}
                    {mensagem && <div className="success-msg">{mensagem}</div>}

                    <button className="recover-submit" disabled={loading}>
                        {loading ? "Enviando..." : "Enviar recuperação"}
                    </button>

                    <p className="recover-login">
                        Lembrou sua senha?
                        <span onClick={() => navigate("/login")}>Entrar</span>
                    </p>

                    <div className="recover-footer-links">
                        <span onClick={() => navigate("/termos")}>Termos</span>
                        <span onClick={() => navigate("/privacidade")}>Privacidade</span>
                        <span onClick={() => navigate("/cookies")}>Cookies</span>
                        <span onClick={() => navigate("/ajuda")}>Ajuda</span>
                    </div>
                </form>
            </section>
        </main>
    );
}
