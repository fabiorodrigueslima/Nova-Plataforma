import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function Cookies() {

    const navigate = useNavigate();

    return (

        <main className="legal-page">

            <section className="legal-container">

                {/* ================= BRAND ================= */}

                <div className="legal-brand">

                    <div className="legal-logo">
                        P
                    </div>

                    <h1>POSTFAN</h1>

                </div>

                {/* ================= TOP ================= */}

                <div className="legal-top">

                    <button
                        className="legal-back"
                        onClick={() => navigate(-1)}
                    >
                        ← Voltar
                    </button>

                    <h2>Política de Cookies</h2>

                    <p>
                        Saiba como utilizamos cookies e tecnologias
                        semelhantes para melhorar sua experiência
                        dentro da plataforma Postfan.
                    </p>

                </div>

                {/* ================= CONTENT ================= */}

                <div className="legal-content">

                    <section>

                        <h2>1. O que são Cookies?</h2>

                        <p>
                            Cookies são pequenos arquivos armazenados
                            no navegador do usuário para melhorar
                            funcionalidades, segurança e desempenho
                            da plataforma.
                        </p>

                    </section>

                    <section>

                        <h2>2. Como utilizamos os Cookies</h2>

                        <p>
                            Utilizamos cookies para:
                        </p>

                        <ul>

                            <li>
                                Manter você conectado em sua conta.
                            </li>

                            <li>
                                Melhorar desempenho e carregamento.
                            </li>

                            <li>
                                Salvar preferências do usuário.
                            </li>

                            <li>
                                Garantir segurança da plataforma.
                            </li>

                            <li>
                                Personalizar sua experiência.
                            </li>

                        </ul>

                    </section>

                    <section>

                        <h2>3. Tipos de Cookies</h2>

                        <div className="cookies-grid">

                            <div className="cookie-card">

                                <h3>Cookies Essenciais</h3>

                                <p>
                                    Necessários para funcionamento básico
                                    da plataforma.
                                </p>

                            </div>

                            <div className="cookie-card">

                                <h3>Cookies de Segurança</h3>

                                <p>
                                    Protegem contas e ajudam na prevenção
                                    de acessos indevidos.
                                </p>

                            </div>

                            <div className="cookie-card">

                                <h3>Cookies de Desempenho</h3>

                                <p>
                                    Melhoram estabilidade, velocidade
                                    e carregamento do sistema.
                                </p>

                            </div>

                            <div className="cookie-card">

                                <h3>Cookies de Preferências</h3>

                                <p>
                                    Salvam configurações e preferências
                                    do usuário.
                                </p>

                            </div>

                        </div>

                    </section>

                    <section>

                        <h2>4. Controle de Cookies</h2>

                        <p>
                            Você pode desativar cookies diretamente
                            no navegador. Porém, algumas funcionalidades
                            podem deixar de funcionar corretamente.
                        </p>

                    </section>

                    <section>

                        <h2>5. Alterações nesta Política</h2>

                        <p>
                            Esta política poderá ser atualizada
                            periodicamente para melhorias de segurança,
                            desempenho e conformidade legal.
                        </p>

                    </section>

                </div>

            </section>

        </main>

    );
}