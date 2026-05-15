import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

        setLoading(true);

        try {

            const res = await fetch("http://localhost:5000/recuperar", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok) {

                setMensagem(
                    "Enviamos um link de recuperação para seu email."
                );

            } else {

                setErro(data.erro || "Erro ao recuperar senha.");

            }

        } catch {

            setErro("Erro ao conectar com o servidor.");

        }

        setLoading(false);

    }

    return (

        <main className="recover-page">

            {/* ================= LEFT ================= */}

            <section className="recover-left">

                <div className="recover-brand">

                    <div className="recover-logo">
                        P
                    </div>

                    <h1>POSTFAN</h1>

                </div>

                <div className="recover-left-content">

                    <h2>
                        Recuperar
                        <br />
                        sua senha
                    </h2>

                    <p>
                        Informe seu email para receber
                        um link de recuperação da sua conta.
                    </p>

                </div>

            </section>

            {/* ================= RIGHT ================= */}

            <section className="recover-right">

                <form
                    className="recover-card"
                    onSubmit={handleRecuperar}
                >

                    <h2>Esqueci minha senha</h2>

                    <p className="recover-subtitle">
                        Digite o email da sua conta.
                    </p>

                    <label>E-mail</label>

                    <input
                        type="email"
                        placeholder="Digite seu email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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

                        {loading
                            ? "Enviando..."
                            : "Enviar recuperação"}

                    </button>

                    <p className="recover-login">

                        Lembrou sua senha?

                        <span
                            onClick={() => navigate("/login")}
                        >
                            Entrar
                        </span>

                    </p>

                    <div className="recover-footer-links">

                        <span onClick={() => navigate("/termos")}>
                            Termos
                        </span>

                        <span onClick={() => navigate("/privacidade")}>
                            Privacidade
                        </span>

                        <span onClick={() => navigate("/cookies")}>
                            Cookies
                        </span>

                        <span onClick={() => navigate("/ajuda")}>
                            Ajuda
                        </span>

                    </div>

                </form>

            </section>

        </main>

    );
}