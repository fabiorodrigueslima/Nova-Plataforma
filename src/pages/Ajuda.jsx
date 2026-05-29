import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function Ajuda() {

    const navigate = useNavigate();

    return (

        <main className="legal-page">

            <section className="legal-container">

                {/* ================= BRAND ================= */}

                <div className="legal-brand">

                    <div className="legal-logo">
                        P
                    </div>

                    <h1>PostFan</h1>

                </div>

                {/* ================= TOP ================= */}

                <div className="legal-top">

                    <button
                        className="legal-back"
                        onClick={() => navigate(-1)}
                    >
                        ← Voltar
                    </button>

                    <h2>Central de Ajuda</h2>

                    <p>
                        Bem-vindo à Central de Ajuda do Postfan.
                        Aqui você encontra informações importantes
                        sobre cadastro, recuperação de conta,
                        salas virtuais e suporte da plataforma.
                    </p>

                </div>

                {/* ================= CONTENT ================= */}

                <div className="legal-content">

                    {/* ================= CADASTRO ================= */}

                    <section>

                        <h2>1. Como criar uma conta</h2>

                        <p>
                            Para criar sua conta no Postfan:
                        </p>

                        <ul>

                            <li>
                                Clique em "Criar Conta".
                            </li>

                            <li>
                                Preencha nome, email e senha.
                            </li>

                            <li>
                                Adicione uma foto de perfil (opcional).
                            </li>

                            <li>
                                Aceite os termos da plataforma.
                            </li>

                            <li>
                                Clique em "Criar Minha Conta".
                            </li>

                        </ul>

                    </section>

                    {/* ================= RECUPERAR ================= */}

                    <section>

                        <h2>2. Recuperar senha</h2>

                        <p>
                            Caso tenha esquecido sua senha:
                        </p>

                        <ul>

                            <li>
                                Vá até a tela de login.
                            </li>

                            <li>
                                Clique em "Esqueci minha senha".
                            </li>

                            <li>
                                Informe seu email cadastrado.
                            </li>

                            <li>
                                Você receberá um link de recuperação.
                            </li>

                            <li>
                                Crie uma nova senha e volte a acessar.
                            </li>

                        </ul>

                    </section>

                    {/* ================= SALA ================= */}

                    <section>

                        <h2>3. Como criar uma Sala Virtual</h2>

                        <p>
                            As Salas Virtuais permitem criar
                            grupos de conversa e comunidades.
                        </p>

                        <ul>

                            <li>
                                Acesse o menu "Sala Virtual".
                            </li>

                            <li>
                                Clique em "Criar Sala".
                            </li>

                            <li>
                                Escolha nome e descrição da sala.
                            </li>

                            <li>
                                Defina regras e interesses.
                            </li>

                            <li>
                                Compartilhe sua sala com outras pessoas.
                            </li>

                        </ul>

                    </section>

                    {/* ================= CONVIDAR ================= */}

                    <section>

                        <h2>4. Como convidar pessoas para a sala</h2>

                        <p>
                            Você pode convidar amigos e usuários
                            para participar das salas criadas.
                        </p>

                        <ul>

                            <li>
                                Abra sua sala virtual.
                            </li>

                            <li>
                                Clique em "Convidar Pessoas".
                            </li>

                            <li>
                                Compartilhe o link da sala.
                            </li>

                            <li>
                                Usuários poderão entrar pelo convite.
                            </li>

                        </ul>

                    </section>

                    {/* ================= SEGURANÇA ================= */}

                    <section>

                        <h2>5. Segurança da Conta</h2>

                        <p>
                            Para proteger sua conta:
                        </p>

                        <ul>

                            <li>
                                Nunca compartilhe sua senha.
                            </li>

                            <li>
                                Utilize senhas fortes.
                            </li>

                            <li>
                                Evite clicar em links suspeitos.
                            </li>

                            <li>
                                Denuncie atividades estranhas.
                            </li>

                        </ul>

                    </section>

                    {/* ================= EMAIL ================= */}

                    <section>

                        <h2>6. Suporte e Contato</h2>

                        <p>
                            Caso precise de ajuda adicional,
                            entre em contato com nossa equipe:
                        </p>

                        <div className="support-box">

                            <div className="support-item">

                                <h3>Email de suporte</h3>

                                <p>
                                    suporte@postfan.com
                                </p>

                            </div>

                            <div className="support-item">

                                <h3>Atendimento</h3>

                                <p>
                                    Segunda a Sexta - 08h às 18h
                                </p>

                            </div>

                            <div className="support-item">

                                <h3>Plataforma</h3>

                                <p>
                                    Comunidade Postfan
                                </p>

                            </div>

                        </div>

                    </section>

                </div>

            </section>

        </main>

    );
}