import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/style.css";
import api from "../services/api";

export default function EditarPerfil() {
    const navigate = useNavigate();

    const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));

    const [modalSucesso, setModalSucesso] = useState(false);
    const [mensagemSucesso, setMensagemSucesso] = useState("");

    const [form, setForm] = useState({
        nome: "",
        bio: "",
        essencia_representa: "",
        essencia_tema: "",
        essencia_frase: "",
        aberto_para: "",
    });

    const [foto, setFoto] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(false);
    const [carregando, setCarregando] = useState(true);

    async function carregarDados() {
        try {
            const res = await api.get("/me");
            const data = res.data;

            setForm({
                nome: data.nome || "",
                bio: data.bio || "",
                essencia_representa: data.essencia_representa || "",
                essencia_tema: data.essencia_tema || "",
                essencia_frase: data.essencia_frase || "",
                aberto_para: data.aberto_para || "",
            });

            setPreview(data.foto || "");
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            alert("Erro ao carregar dados do perfil.");
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        carregarDados();
    }, []);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    function fecharModal() {
        setModalSucesso(false);
        navigate(`/perfil/${usuarioLocal.id}`);
    }

    function handleFoto(e) {
        const file = e.target.files[0];

        if (!file) return;

        setFoto(file);
        setPreview(URL.createObjectURL(file));
    }

    async function salvarPerfil(e) {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();

            formData.append("nome", form.nome);
            formData.append("bio", form.bio);
            formData.append("essencia_representa", form.essencia_representa);
            formData.append("essencia_tema", form.essencia_tema);
            formData.append("essencia_frase", form.essencia_frase);
            formData.append("aberto_para", form.aberto_para);

            if (foto) {
                formData.append("foto", foto);
            }

            const res = await api.put("/perfil", formData);
            const data = res.data;

            localStorage.setItem("usuario", JSON.stringify(data.usuario));

            setMensagemSucesso(
                "Seu perfil foi atualizado com sucesso. Agora suas informações já aparecem no PostFan."
            );

            setModalSucesso(true);
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert(error.response?.data?.erro || "Erro ao salvar perfil.");
        } finally {
            setLoading(false);
        }
    }

    if (carregando) {
        return (
            <main className="editar-perfil-pro-page">
                <div className="editar-loading-pro">Carregando dados...</div>
            </main>
        );
    }

    return (
        <main className="editar-perfil-pro-page">
            <section className="editar-perfil-pro-container">
                <aside className="editar-preview-pro">
                    <div className="editar-preview-cover"></div>

                    <div className="editar-preview-avatar">
                        {preview ? <img src={preview} alt="Preview do perfil" /> : <span>?</span>}
                    </div>

                    <h2>{form.nome || "Seu nome"}</h2>
                    <p>@{usuarioLocal?.email || "usuario@email.com"}</p>

                    <div className="editar-preview-bio">
                        {form.bio || "Sua bio aparecerá aqui enquanto você edita o perfil."}
                    </div>

                    <button type="button" onClick={() => navigate(`/perfil/${usuarioLocal.id}`)}>
                        Ver meu perfil
                    </button>
                </aside>

                <form className="editar-form-pro" onSubmit={salvarPerfil}>
                    <div className="editar-form-top">
                        <button
                            type="button"
                            className="editar-voltar-pro"
                            onClick={() => navigate("/feed")}
                        >
                            ← Voltar para o feed
                        </button>

                        <div>
                            <span>Configurações do perfil</span>
                            <h1>Editar perfil</h1>
                            <p>Atualize sua foto, bio e as informações que aparecem para outros usuários.</p>
                        </div>
                    </div>

                    <div className="editar-upload-pro">
                        <div className="editar-upload-avatar">
                            {preview ? <img src={preview} alt="Preview" /> : <span>?</span>}
                        </div>

                        <div>
                            <h3>Foto do perfil</h3>
                            <p>Escolha uma imagem clara para outros usuários reconhecerem você.</p>

                            <label className="editar-upload-btn">
                                Alterar foto
                                <input type="file" accept="image/*" onChange={handleFoto} />
                            </label>
                        </div>
                    </div>

                    <div className="editar-grid-pro">
                        <label>
                            Nome
                            <input
                                type="text"
                                name="nome"
                                value={form.nome}
                                onChange={handleChange}
                                placeholder="Digite seu nome"
                                required
                            />
                        </label>

                        <label>
                            Meu tema favorito
                            <input
                                type="text"
                                name="essencia_tema"
                                value={form.essencia_tema}
                                onChange={handleChange}
                                placeholder="Ex: Tecnologia, esporte, religião..."
                            />
                        </label>
                    </div>

                    <label>
                        Bio
                        <textarea
                            name="bio"
                            value={form.bio}
                            onChange={handleChange}
                            placeholder="Fale um pouco sobre você..."
                            maxLength="220"
                        />
                        <small>{form.bio.length}/220 caracteres</small>
                    </label>

                    <label>
                        O que me representa
                        <textarea
                            name="essencia_representa"
                            value={form.essencia_representa}
                            onChange={handleChange}
                            placeholder="Ex: Sou uma pessoa que gosta de aprender, criar e ajudar pessoas."
                        />
                    </label>

                    <label>
                        Minha frase
                        <textarea
                            name="essencia_frase"
                            value={form.essencia_frase}
                            onChange={handleChange}
                            placeholder="Ex: Todo mundo merece ter voz."
                        />
                    </label>

                    <label>
                        Estou aberto para
                        <input
                            type="text"
                            name="aberto_para"
                            value={form.aberto_para}
                            onChange={handleChange}
                            placeholder="Ex: Conversar, debater, aprender..."
                        />
                    </label>

                    <div className="editar-actions-pro">
                        <button type="button" className="editar-cancelar-pro" onClick={() => navigate(-1)}>
                            Cancelar
                        </button>

                        <button type="submit" className="editar-salvar-pro" disabled={loading}>
                            {loading ? "Salvando..." : "Salvar alterações"}
                        </button>
                    </div>
                </form>
            </section>

            {modalSucesso && (
                <div className="modal-overlay-pro">
                    <div className="modal-sucesso-pro">
                        <div className="modal-sucesso-icon-pro">✅</div>

                        <h2>Perfil atualizado!</h2>

                        <p>{mensagemSucesso}</p>

                        <button className="modal-ok-btn-pro" onClick={fecharModal}>
                            Ir para meu perfil
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
