import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../styles/style.css";

export default function ResetarSenha() {

    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    const token = searchParams.get("token");

    const [senha, setSenha] = useState("");

    const [confirmarSenha, setConfirmarSenha] = useState("");

    const [loading, setLoading] = useState(false);

    const [mensagem, setMensagem] = useState("");

    const [erro, setErro] = useState("");

    async function handleResetar(e) {

        e.preventDefault();

        setErro("");
        setMensagem("");

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

        setLoading(true);

        try {

            const res = await fetch("http://localhost:5000/resetar", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    token,
                    novaSenha: senha,
                }),
            });

            const data = await res.json();

            if (res.ok) {

                setMensagem("Senha alterada com sucesso!");

                setTimeout(() => {
                    navigate("/login");
                }, 2000);

            } else {

                setErro(data.erro || "Erro ao redefinir senha.");

            }

        } catch {

            setErro("Erro ao conectar com o servidor.");

        }

        setLoading(false);

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

                        {loading
                            ? "Salvando..."
                            : "Salvar nova senha"}

                    </button>

                </form>

            </section>

        </main>

    );
}