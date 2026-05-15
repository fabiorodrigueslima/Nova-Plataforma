import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function Privacidade() {

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

                    <h2>Termos de Privacidade</h2>

                    <p>
                        Leia atentamente nossos termos,
                        políticas e diretrizes da plataforma.
                    </p>

                </div>
                <div className="legal-content">

                    <section>

                        <h2>1. Coleta de Dados</h2>

                        <p>
                            Coletamos informações necessárias
                            para funcionamento da plataforma,
                            como nome, email e dados de acesso.
                        </p>

                    </section>

                    <section>

                        <h2>2. Uso das Informações</h2>

                        <p>
                            Os dados são utilizados para
                            autenticação, segurança, melhorias
                            da plataforma e experiência do usuário.
                        </p>

                    </section>

                    <section>

                        <h2>3. Compartilhamento</h2>

                        <p>
                            O Postfan não vende dados pessoais
                            dos usuários para terceiros.
                        </p>

                    </section>

                    <section>

                        <h2>4. Segurança</h2>

                        <p>
                            Utilizamos medidas de proteção
                            para evitar acessos não autorizados.
                        </p>

                    </section>

                    <section>

                        <h2>5. Direitos do Usuário</h2>

                        <p>
                            O usuário poderá solicitar alteração
                            ou remoção de dados pessoais.
                        </p>

                    </section>

                </div>

            </section>

        </main>

    );
}