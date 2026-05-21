import { useNavigate } from "react-router-dom";

import "../styles/style.css";

export default function Termos() {
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

          <h2>Termos de Uso</h2>

          <p>
            Leia atentamente nossos termos,
            políticas e diretrizes da plataforma.
          </p>
        </div>

        <div className="legal-content">

          <section>
            <h2>1. Aceitação dos Termos</h2>

            <p>
              Ao acessar a plataforma Postfan,
              você concorda com todos os termos,
              regras e políticas descritas nesta página.
            </p>
          </section>

          <section>
            <h2>2. Objetivo da Plataforma</h2>

            <p>
              O Postfan é uma rede social criada para
              compartilhamento de ideias, debates,
              conteúdos e interação entre usuários.
            </p>
          </section>

          <section>
            <h2>3. Regras de Conduta</h2>

            <ul>
              <li>
                Respeitar outros usuários.
              </li>

              <li>
                Não publicar conteúdos ilegais.
              </li>

              <li>
                Não praticar discriminação ou discurso de ódio.
              </li>

              <li>
                Não compartilhar informações falsas prejudiciais.
              </li>

              <li>
                Não invadir contas ou sistemas.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Privacidade e Segurança</h2>

            <p>
              O Postfan busca proteger os dados dos usuários,
              utilizando medidas de segurança para evitar acessos
              indevidos e vazamentos de informações.
            </p>

            <p>
              O usuário também é responsável por manter sua senha
              segura e não compartilhar seus dados de acesso.
            </p>
          </section>

          <section>
            <h2>5. Suspensão de Conta</h2>

            <p>
              Contas que violarem as regras poderão
              ser suspensas ou removidas sem aviso prévio.
            </p>
          </section>

          <section>
            <h2>6. Conteúdo Publicado</h2>

            <p>
              Cada usuário é totalmente responsável pelos conteúdos,
              comentários, imagens e arquivos publicados dentro da plataforma.
            </p>

            <p>
              O Postfan poderá remover conteúdos considerados ofensivos,
              ilegais ou que violem as políticas da comunidade.
            </p>
          </section>

          <section>
            <h2>7. Alterações nos Termos</h2>

            <p>
              O Postfan poderá atualizar estes termos
              a qualquer momento para melhorar a segurança
              e experiência dos usuários.
            </p>
          </section>

          <section>
            <h2>8. Contato</h2>

            <p>
              Em caso de dúvidas, sugestões ou denúncias,
              o usuário poderá entrar em contato através
              dos canais oficiais da plataforma.
            </p>
          </section>

        </div>
      </section>
    </main>
  );
}