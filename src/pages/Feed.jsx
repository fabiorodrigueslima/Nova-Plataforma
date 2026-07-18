import { useState } from "react";
import {
    FiBell,
    FiCompass,
    FiEdit2,
    FiHelpCircle,
    FiHome,
    FiLogOut,
    FiMenu,
    FiMessageCircle,
    FiPlusSquare,
    FiSearch,
    FiSettings,
    FiShield,
    FiUser,
    FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import FeedCenter from "../components/FeedCenter";
import RightPanel from "../components/RightPanel";

import "../styles/style.css";

export default function Feed() {
    const navigate = useNavigate();
    const [temaAtivo, setTemaAtivo] = useState("Todos");
    const [menuMobileAberto, setMenuMobileAberto] = useState(false);
    const [pedidoAbrirPostfan, setPedidoAbrirPostfan] = useState(0);

    const [posts, setPosts] = useState(() => {
        const salvos = localStorage.getItem("postsPostfan");
        return salvos ? JSON.parse(salvos) : [];
    });

    function navegarMobile(rota) {
        setMenuMobileAberto(false);
        navigate(rota);
    }

    function sair() {
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        setMenuMobileAberto(false);
        navigate("/login");
    }

    return (
        <div className="feed-shell">
            <header className="mobile-app-header">
                <button
                    className="mobile-brand"
                    type="button"
                    onClick={() => setPedidoAbrirPostfan((pedido) => pedido + 1)}
                    aria-label="Conheça a história do PostFan"
                    title="Por que o PostFan?"
                >
                    <span>P</span>
                    <strong>PostFan</strong>
                </button>
                <div className="mobile-header-actions">
                    <button type="button" onClick={() => navigate("/explorar")} aria-label="Pesquisar">
                        <FiSearch />
                    </button>
                    <button type="button" onClick={() => navigate("/sugestoes")} aria-label="Notificações">
                        <FiBell />
                    </button>
                    <button type="button" onClick={() => navigate("/mensagens")} aria-label="Mensagens diretas">
                        <FiMessageCircle />
                    </button>
                    <button type="button" onClick={() => setMenuMobileAberto(true)} aria-label="Abrir menu">
                        <FiMenu />
                    </button>
                </div>
            </header>

            <main className="feed-page">
                <Sidebar
                    temaAtivo={temaAtivo}
                    setTemaAtivo={setTemaAtivo}
                    pedidoAbrirPostfan={pedidoAbrirPostfan}
                />

                <FeedCenter
                    temaAtivo={temaAtivo}
                    posts={posts}
                    setPosts={setPosts}
                />

                <RightPanel posts={posts} />
            </main>

            {menuMobileAberto && (
                <div className="mobile-menu-overlay" role="presentation" onClick={() => setMenuMobileAberto(false)}>
                    <aside
                        className="mobile-account-menu"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu da conta"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mobile-menu-heading">
                            <div>
                                <span>Minha conta</span>
                                <strong>PostFan</strong>
                            </div>
                            <button type="button" onClick={() => setMenuMobileAberto(false)} aria-label="Fechar menu">
                                <FiX />
                            </button>
                        </div>

                        <nav aria-label="Opções da conta">
                            <button type="button" onClick={() => navegarMobile("/perfil")}>
                                <FiUser /> <span>Meu perfil</span>
                            </button>
                            <button type="button" onClick={() => navegarMobile("/editar-perfil")}>
                                <FiEdit2 /> <span>Editar perfil</span>
                            </button>
                            <button type="button" onClick={() => navegarMobile("/configuracoes")}>
                                <FiSettings /> <span>Configurações</span>
                            </button>
                            <button type="button" onClick={() => navegarMobile("/privacidade")}>
                                <FiShield /> <span>Privacidade</span>
                            </button>
                            <button type="button" onClick={() => navegarMobile("/ajuda")}>
                                <FiHelpCircle /> <span>Ajuda e suporte</span>
                            </button>
                        </nav>

                        <button className="mobile-menu-logout" type="button" onClick={sair}>
                            <FiLogOut /> <span>Sair da plataforma</span>
                        </button>
                    </aside>
                </div>
            )}

            <nav className="mobile-bottom-nav" aria-label="Navegação principal">
                <button className="active" type="button" onClick={() => setTemaAtivo("Todos")} aria-label="Início">
                    <FiHome />
                    <span>Início</span>
                </button>
                <button type="button" onClick={() => navigate("/explorar")} aria-label="Explorar">
                    <FiCompass />
                    <span>Explorar</span>
                </button>
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Criar publicação">
                    <span className="mobile-create-icon"><FiPlusSquare /></span>
                    <span>Publicar</span>
                </button>
                <button type="button" onClick={() => navigate("/sala-virtual")} aria-label="Salas">
                    <FiMessageCircle />
                    <span>Salas</span>
                </button>
                <button type="button" onClick={() => navigate("/perfil")} aria-label="Perfil">
                    <FiUser />
                    <span>Perfil</span>
                </button>
            </nav>
        </div>
    );
}
