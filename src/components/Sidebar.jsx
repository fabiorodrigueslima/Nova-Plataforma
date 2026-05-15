import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/style.css";

export default function Sidebar({ temaAtivo = "Todos", setTemaAtivo }) {
    const navigate = useNavigate();

    const [mostrarConta, setMostrarConta] = useState(false);
    const [mostrarPostfan, setMostrarPostfan] = useState(false);
    const [mostrarMaisTemas, setMostrarMaisTemas] = useState(false);

    const temas = [
        "Todos",
        "Política",
        "Religião",
        "Esporte",
        "Saúde",
        "Ciência",
        "Entretenimento",
        "Relacionamento",
        "Sobrenatural",
    ];

    const maisTemas = [
        "Tecnologia",
        "Educação",
        "Trabalho",
        "Família",
        "Cultura",
        "Meio Ambiente",
        "Notícias",
    ];

    const icones = {
        Todos: "🌍",
        Política: "🏛️",
        Religião: "✝️",
        Esporte: "⚽",
        Saúde: "🧠",
        Ciência: "🔬",
        Entretenimento: "🎬",
        Relacionamento: "❤️",
        Sobrenatural: "👻",
        Tecnologia: "💻",
        Educação: "📚",
        Trabalho: "💼",
        Família: "👨‍👩‍👧",
        Cultura: "🎭",
        "Meio Ambiente": "🌱",
        Notícias: "📰",
    };

    function escolherTema(tema) {
        if (setTemaAtivo) {
            setTemaAtivo(tema);
        }
    }

    function sair() {
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        navigate("/login");
    }

    return (
        <>
            <aside className="sidebar">
                <div
                    className="sidebar-logo sidebar-logo-click"
                    onClick={() => setMostrarPostfan(true)}
                    title="Clique para entender o nome PostFan"
                >
                    <div className="sidebar-logo-icon">P</div>
                    <h2>
                        PostFan <span>›</span>
                    </h2>
                </div>

                <div className="sidebar-section">
                    <span className="sidebar-title">MENU DEBATES</span>

                    {temas.map((tema) => (
                        <button
                            key={tema}
                            className={`sidebar-item ${temaAtivo === tema ? "active" : ""}`}
                            onClick={() => escolherTema(tema)}
                        >
                            {icones[tema]} {tema}
                        </button>
                    ))}

                    {mostrarMaisTemas &&
                        maisTemas.map((tema) => (
                            <button
                                key={tema}
                                className={`sidebar-item ${temaAtivo === tema ? "active" : ""}`}
                                onClick={() => escolherTema(tema)}
                            >
                                {icones[tema]} {tema}
                            </button>
                        ))}

                    <button
                        className="sidebar-see-more"
                        onClick={() => setMostrarMaisTemas(!mostrarMaisTemas)}
                    >
                        {mostrarMaisTemas ? "Ver menos" : "Ver tudo"}
                    </button>
                </div>

                <div className="sidebar-room">
                    <button onClick={() => navigate("/sala-virtual")}>
                        🎤 Entrar na Sala Virtual
                    </button>
                    <p>
                        Converse ao vivo com a comunidade e participe de debates em tempo real.
                    </p>
                </div>

                <div className="sidebar-bottom">
                    <button
                        className="sidebar-account"
                        onClick={() => setMostrarConta(!mostrarConta)}
                    >
                        👤 Minha conta ›
                    </button>

                    {mostrarConta && (
                        <div className="account-menu">
                            <button onClick={() => navigate("/perfil")}>👤 Meu perfil</button>
                            <button onClick={() => navigate("/editar-perfil")}>
                                ✏️ Editar perfil
                            </button>
                            <button onClick={() => navigate("/configuracoes")}>
                                ⚙️ Configurações
                            </button>
                            <button onClick={() => navigate("/privacidade")}>
                                🔒 Privacidade
                            </button>
                            <button onClick={() => navigate("/ajuda")}>❓ Ajuda</button>
                        </div>
                    )}

                    <div
                        className="sidebar-about"
                        onClick={() => setMostrarPostfan(true)}
                        title="Clique para entender o nome PostFan"
                    >
                        <strong>Por que o PostFan?</strong>
                        <p>Clique para entender a história do nosso nome.</p>
                    </div>

                    <button className="sidebar-logout" onClick={sair}>
                        🚪 Sair da plataforma
                    </button>
                </div>
            </aside>

            {mostrarPostfan && (
                <div className="postfan-modal-overlay">
                    <div className="postfan-modal">
                        <button
                            className="postfan-modal-close"
                            onClick={() => setMostrarPostfan(false)}
                        >
                            ×
                        </button>

                        <h2>Como surgiu o “PostFan”?</h2>

                        <p>
                            A ideia do “Postfan” surgiu de três colegas que frequentavam um
                            curso de qualificação profissional em Brasília/DF: César, Fábio e
                            Wilker. No início era apenas um projeto final que deveria ser
                            apresentado e avaliado para o recebimento do certificado.
                        </p>

                        <p>
                            Com o tempo, a ideia superou as expectativas e o projeto foi
                            bastante elogiado pelos professores e colegas da turma. Isso serviu
                            de motivação para que o projeto fosse aprimorado e transformado em
                            uma plataforma interativa voltada para um público-alvo diversificado.
                        </p>

                        <h3>Mas o que é o “Postfan”?</h3>

                        <p>
                            O “Postfan” é um espaço digital criado para as pessoas que gostam
                            de acompanhar e debater sobre assuntos variados, como política,
                            religião, esporte, ciência, saúde, relacionamento, sobrenatural,
                            entretenimento e muito mais.
                        </p>

                        <p>
                            Todos podem acessar a plataforma e interagir através de opiniões e
                            postagens de textos e vídeos. É um ambiente em que você tem a
                            liberdade de se expressar, fazer críticas e compartilhar sua opinião.
                        </p>

                        <p>
                            Portanto, a plataforma “Postfan” promove a discussão e argumentação,
                            valoriza o debate fundamentado, a construção coletiva do conhecimento
                            e o respeito à diversidade de opiniões.
                        </p>

                        <strong className="postfan-final">
                            Aqui a sua opinião é vista por todos!
                        </strong>
                    </div>
                </div>
            )}
        </>
    );
}