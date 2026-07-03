import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import { GoogleLogin } from "@react-oauth/google";

import { useAuth } from "../context/AuthContext";
import { loginComEmail, loginComGoogle } from "../services/auth";
import { getGoogleClientIdStatus } from "../utils/googleOAuth";
import imagem3 from "../assets/img/imagem3.png";
import "../styles/style.css";

export default function Login() {
    const navigate = useNavigate();
    const { salvarSessao } = useAuth();
    const googleClientIdStatus = getGoogleClientIdStatus();

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

        try {
            setLoading(true);

            const data = await loginComEmail(form);

            if (!data.autenticado && !data.token) {
                setErro(data.erro || "Email ou senha inválidos.");
                return;
            }

            salvarSessao(data.token, data.usuario);
            navigate("/feed");
        } catch (error) {
            if (!error.response || error.response.status >= 500) {
                console.error("Erro ao fazer login:", error);
            }

            setErro(error.response?.data?.erro || "Email ou senha inválidos.");
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleSuccess(credentialResponse) {
        setErro("");

        try {
            setLoading(true);
            const data = await loginComGoogle(credentialResponse.credential);
            salvarSessao(data.token, data.usuario);
            navigate("/feed");
        } catch (error) {
            setErro(error.response?.data?.erro || "Não foi possível entrar com Google.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-left">
                <div className="login-brand">
                    <div className="login-logo">P</div>
                    <h1>POSTFAN</h1>
                </div>

                <img src={imagem3} alt="Postfan" className="login-image" />
                <div className="login-overlay" />

                <div className="login-left-content">
                    <h2>
                        Bem-vindo ao
                        <br />
                        PostFan
                    </h2>

                    <p>Entre, participe de debates e compartilhe suas ideias com o mundo.</p>
                </div>
            </section>

            <section className="login-right">
                <form className="login-card" onSubmit={handleLogin}>
                    <h2>Entrar</h2>

                    <p className="login-subtitle">Acesse sua conta para continuar.</p>

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

                        <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}>
                            {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <div className="forgot-password">
                        <span onClick={() => navigate("/recuperar")}>Esqueci minha senha</span>
                    </div>

                    {erro && <div className="erro-msg">{erro}</div>}

                    <button className="login-submit" disabled={loading}>
                        {loading ? "Entrando..." : "Entrar"}
                    </button>

                    <div className="login-divider">
                        <span>ou</span>
                    </div>

                    {googleClientIdStatus.configured ? (
                        <div className="google-login-wrapper">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setErro("Não foi possível entrar com Google.")}
                                text="signin_with"
                                shape="pill"
                                width="320"
                            />
                        </div>
                    ) : (
                        <button type="button" className="login-google" disabled>
                            <FaGoogle />
                            {googleClientIdStatus.message}
                        </button>
                    )}

                    <p className="login-create">
                        Não tem conta?
                        <span onClick={() => navigate("/cadastro")}>Criar conta</span>
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
