import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../styles/style.css";

export default function ResetarSenha() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");

    async function resetarSenha(e) {
        e.preventDefault();

        setMensagem("");
        setErro("");

        if (!token) {
            setErro("Token inválido ou não encontrado.");
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
            setErro("As senhas não são iguais.");
            return;
        }

        try {
            setLoading(true);

            const resposta = await fetch("http://localhost:5000/resetar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    novaSenha: senha
                })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                setErro(dados.erro || "Erro ao redefinir senha.");
                return;
            }

            setMensagem("Senha alterada com sucesso. Agora você já pode entrar.");
            setSenha("");
            setConfirmarSenha("");
        } catch (error) {
            setErro("Erro ao conectar com o servidor.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <h1>Nova senha</h1>
                <p>Crie uma nova senha para sua conta.</p>

                <form onSubmit={resetarSenha}>
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

                    {erro && <div className="auth-error">{erro}</div>}
                    {mensagem && <div className="auth-success">{mensagem}</div>}

                    <button type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar nova senha"}
                    </button>
                </form>

                <div className="auth-link">
                    Voltar para <Link to="/login">Login</Link>
                </div>

                <div className="auth-footer-links">
                    <Link to="/termos">Termos</Link>
                    <Link to="/privacidade">Privacidade</Link>
                    <Link to="/cookies">Cookies</Link>
                    <Link to="/ajuda">Ajuda</Link>
                </div>
            </section>
        </main>
    );
}