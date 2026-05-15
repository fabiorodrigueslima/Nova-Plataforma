import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGoogle, FaEye, FaEyeSlash } from "react-icons/fa";
import imagem3 from "../assets/img/imagem3.png";
import "../styles/style.css";
import api from "../services/api";

export default function Login() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        senha: "",
    });

    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [erro, setErro] = useState("");
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    async function handleLogin(e) {
        e.preventDefault();

        setErro("");

        if (!form.email || !form.senha) {
            setErro("Preencha o email e a senha.");
            return;
        }

        setLoading(true);

        try {

            const res = await api.post("/login", form);

            const data = res.data;

            if (data.token) {
                localStorage.setItem("token", data.token);
            }

            localStorage.setItem(
                "usuario",
                JSON.stringify(data.usuario)
            );

            navigate("/feed");

        } catch (error) {

            setErro(
                error.response?.data?.erro ||
                "Email ou senha inválidos."
            );
        }

        setLoading(false);
    }

    return (
        <main className="login-page">
            <section className="login-left">
                <div className="login-brand">
                    <div className="login-logo">P</div>
                    <h1>POSTFAN</h1>
                </div>

                <img src={imagem3} alt="Postfan" className="login-image" />

                <div className="login-overlay"></div>

                <div className="login-left-content">
                    <h2>
                        Bem-vindo ao
                        <br />
                        PostFan
                    </h2>

                    <p>
                        Entre, participe de debates e compartilhe
                        suas ideias com o mundo.
                    </p>
                </div>
            </section>

            <section className="login-right">
                <form className="login-card" onSubmit={handleLogin}>
                    <h2>Entrar</h2>

                    <p className="login-subtitle">
                        Acesse sua conta para continuar.
                    </p>

                    <label>E-mail</label>

                    <input
                        name="email"
                        type="email"
                        placeholder="Digite seu email"
                        value={form.email}
                        onChange={handleChange}
                    />

                    <label>Senha</label>

                    <div className="login-password">
                        <input
                            name="senha"
                            type={mostrarSenha ? "text" : "password"}
                            placeholder="Digite sua senha"
                            value={form.senha}
                            onChange={handleChange}
                        />

                        <button
                            type="button"
                            onClick={() => setMostrarSenha(!mostrarSenha)}
                        >
                            {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <div className="forgot-password">
                        <span onClick={() => navigate("/recuperar")}>
                            Esqueci minha senha
                        </span>
                    </div>

                    {erro && <div className="erro-msg">{erro}</div>}

                    <button className="login-submit" disabled={loading}>
                        {loading ? "Entrando..." : "Entrar"}
                    </button>

                    <div className="login-divider">
                        <span>ou</span>
                    </div>

                    <button type="button" className="login-google">
                        <FaGoogle />
                        Fazer login com o Google
                    </button>

                    <p className="login-create">
                        Não tem conta?
                        <span onClick={() => navigate("/cadastro")}>
                            Criar conta
                        </span>
                    </p>

                    <div className="login-footer-links">
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