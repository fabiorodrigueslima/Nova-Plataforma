import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function SalaReservada() {
    const navigate = useNavigate();

    return (
        <main className="sala-reservada-page">

            <section className="sala-reservada-hero">

                <button
                    className="sala-voltar"
                    onClick={() => navigate("/sala-virtual")}
                >
                    ← Voltar
                </button>

                <div className="sala-reservada-content">

                    <div className="sala-badge">
                        🔒 Ambiente Privado
                    </div>

                    <h1>
                        Sala Reservada
                    </h1>

                    <p className="sala-reservada-desc">
                        Um espaço privado para conversas mais próximas,
                        debates reservados, estudos, amizades e troca
                        de ideias com pessoas selecionadas.
                    </p>

                    <div className="sala-reservada-box">

                        <div className="sala-card">
                            <h3>🔐 Privacidade</h3>

                            <p>
                                Apenas pessoas convidadas podem entrar
                                através do código compartilhado pelo administrador.
                            </p>
                        </div>

                        <div className="sala-card">
                            <h3>👥 Comunidade</h3>

                            <p>
                                Crie conexões verdadeiras com usuários
                                que possuem interesses em comum.
                            </p>
                        </div>

                        <div className="sala-card">
                            <h3>💬 Conversas</h3>

                            <p>
                                Debata ideias, compartilhe experiências
                                e converse em um ambiente mais reservado.
                            </p>
                        </div>

                    </div>

                    <div className="sala-reservada-actions">

                        <button
                            className="sala-btn-primary"
                            onClick={() => navigate("/sala-virtual")}
                        >
                            Criar Sala
                        </button>

                        <button
                            className="sala-btn-secondary"
                            onClick={() => navigate("/feed")}
                        >
                            Voltar ao Feed
                        </button>

                    </div>

                </div>

            </section>

        </main>
    );
}