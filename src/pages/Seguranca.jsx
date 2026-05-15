import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function Seguranca() {

    const navigate = useNavigate();

    return (

        <main className="legal-page">

            <section className="legal-container">

                <div className="legal-top">

                    <div className="legal-brand">

                        <div className="legal-logo">
                            P
                        </div>

                        <h1>POSTFAN</h1>

                    </div>

                    <button
                        className="legal-back"
                        onClick={() => navigate(-1)}
                    >
                        ← Voltar
                    </button>

                    <h2>Termos de Segurança</h2>

                    <p>
                        Leia atentamente nossos termos,
                        políticas e diretrizes da plataforma.
                    </p>

                </div>

                <div className="legal-content">

                    <section>

                        <h2>1. Proteção de Conta</h2>

                        <p>
                            Recomendamos o uso de senhas fortes
                            e não compartilhamento de acesso.
                        </p>

                    </section>

                    <section>

                        <h2>2. Monitoramento</h2>

                        <p>
                            Atividades suspeitas podem ser analisadas
                            para garantir segurança da comunidade.
                        </p>

                    </section>

                    <section>

                        <h2>3. Proteção de Dados</h2>

                        <p>
                            Utilizamos tecnologias modernas
                            para proteger dados e acessos.
                        </p>

                    </section>

                    <section>

                        <h2>4. Denúncias</h2>

                        <p>
                            Usuários podem denunciar conteúdos,
                            perfis ou comportamentos inadequados.
                        </p>

                    </section>

                    <section>

                        <h2>5. Atualizações</h2>

                        <p>
                            Nossos sistemas passam por melhorias
                            constantes de proteção e estabilidade.
                        </p>

                    </section>

                </div>

            </section>

        </main>

    );
}