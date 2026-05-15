import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGoogle, FaImage, FaEye, FaEyeSlash } from "react-icons/fa";
import Imagem3 from "../assets/Img/imagem3.png";
import "../styles/style.css";

export default function Cadastro() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        nome: "",
        email: "",
        data_nascimento: "",
        senha: "",
    });

    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [aceitouTermos, setAceitouTermos] = useState(false);
    const [maiorIdade, setMaiorIdade] = useState(false);
    const [erro, setErro] = useState("");
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    function handleFoto(e) {
        const arquivo = e.target.files[0];

        if (!arquivo) return;

        const preview = URL.createObjectURL(arquivo);

        setForm({
            ...form,
            foto: preview,
        });
    }

    async function handleCadastro(e) {
        e.preventDefault();

        setErro("");

        if (!form.nome || !form.email || !form.data_nascimento || !form.senha) {
            setErro("Preencha todos os campos obrigatórios.");
            return;
        }

        if (!maiorIdade) {
            setErro("Confirme que possui 18 anos ou mais.");
            return;
        }

        if (!aceitouTermos) {
            setErro("Aceite os termos para continuar.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("http://localhost:5000/cadastro", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.token) {
                    localStorage.setItem("token", data.token);
                }

                localStorage.setItem("usuario", JSON.stringify(data.usuario));

                navigate("/feed");
            } else {
                setErro(data.erro || "Erro ao criar conta.");
            }
        } catch {
            setErro("Erro ao conectar com o servidor.");
        }

        setLoading(false);
    }

    return (
        <main className="auth-page">
            <section className="auth-left">
                <div className="auth-top-content">
                    <div className="auth-logo-box">
                        <div className="logo-icon">P</div>
                        <h1>POSTFAN</h1>
                    </div>

                    <h2>
                        A sua voz,
                        <br />
                        <span>o seu mundo.</span>
                    </h2>

                    <p>
                        Participe das discussões mais quentes,
                        compartilhe sua perspectiva e conecte-se
                        com pessoas que pensam como você.
                    </p>
                </div>

                <div className="auth-image-wrapper">
                    <img src={Imagem3} alt="Postfan" className="auth-image" />

                    <div className="auth-overlay"></div>

                    <div className="chat-real chat-left">
                        <span>💬</span>
                        <p>Que ideia incrível!</p>
                    </div>

                    <div className="chat-real chat-heart">❤️</div>

                    <div className="chat-real chat-right chat-small">
                        MEU DEUS! Isso é real?
                    </div>

                    <div className="chat-real chat-right chat-main">
                        🔥 MEU DEUS! Isso é real?
                    </div>

                    <div className="chat-real chat-right chat-muted">
                        Não acredito no que tô vendo!
                    </div>
                </div>
            </section>

            <section className="auth-right">
                <form className="auth-card" onSubmit={handleCadastro}>
                    <h2>Criar Conta</h2>

                    <p className="auth-subtitle">
                        É grátis e leva menos de 1 minuto
                    </p>

                    <button type="button" className="google-btn">
                        <FaGoogle />
                        Inscrever-se no Google
                    </button>

                    <div className="divider">
                        <span>ou preencha os dados abaixo</span>
                    </div>

                    <div className="foto-upload">
                        <label htmlFor="foto" className="foto-label">
                            {form.foto ? (
                                <img src={form.foto} alt="preview" />
                            ) : (
                                <div className="foto-placeholder">
                                    <div className="foto-icon">
                                        <FaImage />
                                    </div>
                                    <h4>Adicionar foto</h4>
                                    <p>Opcional</p>
                                </div>
                            )}
                        </label>

                        <input
                            id="foto"
                            type="file"
                            accept="image/*"
                            onChange={handleFoto}
                        />
                    </div>

                    <label>Nome completo</label>

                    <input
                        name="nome"
                        type="text"
                        placeholder="Ex: Maria Silva"
                        value={form.nome}
                        onChange={handleChange}
                    />

                    <label>E-mail</label>

                    <input
                        name="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={form.email}
                        onChange={handleChange}
                    />

                    <label>Data de nascimento</label>

                    <input
                        name="data_nascimento"
                        type="date"
                        value={form.data_nascimento}
                        onChange={handleChange}
                    />

                    <label>Senha</label>

                    <div className="password-field">
                        <input
                            name="senha"
                            type={mostrarSenha ? "text" : "password"}
                            placeholder="Mín. 8 caracteres"
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

                    <label className="check-line">
                        <input
                            type="checkbox"
                            checked={maiorIdade}
                            onChange={(e) => setMaiorIdade(e.target.checked)}
                        />
                        Confirmo que tenho 18 anos ou mais.
                    </label>

                    <label className="check-line">
                        <input
                            type="checkbox"
                            checked={aceitouTermos}
                            onChange={(e) => setAceitouTermos(e.target.checked)}
                        />
                        Aceito os termos de uso e privacidade.
                    </label>

                    {erro && <div className="erro-msg">{erro}</div>}

                    <button className="auth-submit" disabled={loading}>
                        {loading ? "Criando conta..." : "Criar Minha Conta Grátis"}
                    </button>

                    <p className="auth-link">
                        Já tem conta?
                        <span onClick={() => navigate("/login")}>
                            Entrar agora
                        </span>
                    </p>

                    <div className="auth-footer-links">
                        <span onClick={() => navigate("/termos")}>Termos</span>
                        <span onClick={() => navigate("/privacidade")}>Privacidade</span>
                        <span onClick={() => navigate("/cookies")}>Cookies</span>
                        <span onClick={() => navigate("/seguranca")}>Segurança</span>
                        <span onClick={() => navigate("/ajuda")}>Ajuda</span>
                    </div>

                    <footer className="auth-footer">
                        © 2026 Postfan. Todos os direitos reservados.
                    </footer>
                </form>
            </section>
        </main>
    );
}