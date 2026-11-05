import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiAward, FiRefreshCw, FiThumbsUp, FiTrash2, FiUsers } from "react-icons/fi";
import api from "../services/api";
import DebatePlacar from "../components/DebatePlacar";
import { useNotification } from "../context/notificationStore";
import { formatarData } from "../utils/FormatarData";
import { resolverUrlMidia } from "../utils/mediaUrl";
import { analisarConteudo } from "../utils/moderacao";
import "../styles/style.css";

const MAX_ARGUMENTO = 800;

function Avatar({ autor }) {
  return (
    <span className="mod-avatar">
      {autor?.foto ? <img src={resolverUrlMidia(autor.foto)} alt="" /> : autor?.nome?.charAt(0) || "?"}
    </span>
  );
}

function CartaoArgumento({ argumento, onVotar, onApagar, onAbrirPerfil }) {
  return (
    <article className={`arg-card lado-${argumento.lado}`}>
      <header>
        <button type="button" className="arg-autor" onClick={() => onAbrirPerfil(argumento.autor?.id)}>
          <Avatar autor={argumento.autor} />
          <span>
            <strong>{argumento.autor?.nome || "Usuário"}</strong>
            <small>{formatarData(argumento.criado_em)}</small>
          </span>
        </button>
        {argumento.meu && (
          <button type="button" className="arg-apagar" onClick={() => onApagar(argumento)} aria-label="Apagar argumento">
            <FiTrash2 aria-hidden="true" />
          </button>
        )}
      </header>
      <p>{argumento.texto}</p>
      <footer>
        <button
          type="button"
          className={`arg-voto ${argumento.votei ? "votei" : ""}`}
          onClick={() => onVotar(argumento)}
          disabled={argumento.meu}
          title={argumento.meu ? "Você não pode avaliar o próprio argumento" : "Este argumento é bom, mesmo que você discorde"}
        >
          <FiThumbsUp aria-hidden="true" /> Bom argumento · {argumento.votos}
        </button>
        {argumento.votos_outro_lado > 0 && (
          <span className="arg-selo respeito" title="Pessoas do outro lado avaliaram bem este argumento">
            <FiUsers aria-hidden="true" /> Respeitado pelo outro lado
          </span>
        )}
        {argumento.convenceu > 0 && (
          <span className="arg-selo convenceu">
            <FiAward aria-hidden="true" /> Convenceu {argumento.convenceu} {argumento.convenceu === 1 ? "pessoa" : "pessoas"}
          </span>
        )}
      </footer>
    </article>
  );
}

function ModalMudanca({ ladoNome, candidatos, onConfirmar, onCancelar }) {
  const [escolhido, setEscolhido] = useState("");
  return (
    <div className="app-dialog-overlay" role="presentation" onClick={onCancelar}>
      <div className="app-dialog mudanca-modal" role="dialog" aria-modal="true" aria-labelledby="mudanca-titulo" onClick={(e) => e.stopPropagation()}>
        <span className="mudanca-icone" aria-hidden="true"><FiRefreshCw /></span>
        <h2 id="mudanca-titulo">Mudou de opinião?</h2>
        <p>
          Mudar de ideia diante de bons argumentos é sinal de maturidade. Você vai para o lado <strong>{ladoNome}</strong>.
          {candidatos.length > 0 && " Algum argumento convenceu você?"}
        </p>
        {candidatos.length > 0 && (
          <div className="mudanca-opcoes" role="radiogroup" aria-label="Argumento que convenceu">
            {candidatos.map((arg) => (
              <label key={arg.id} className={escolhido === String(arg.id) ? "ativo" : ""}>
                <input type="radio" name="argumento" value={arg.id} checked={escolhido === String(arg.id)} onChange={(e) => setEscolhido(e.target.value)} />
                <span>
                  <strong>{arg.autor?.nome}</strong>
                  {arg.texto.length > 160 ? `${arg.texto.slice(0, 160)}…` : arg.texto}
                </span>
              </label>
            ))}
            <label className={escolhido === "" ? "ativo" : ""}>
              <input type="radio" name="argumento" value="" checked={escolhido === ""} onChange={() => setEscolhido("")} />
              <span>Nenhum em especial</span>
            </label>
          </div>
        )}
        <div className="mudanca-acoes">
          <button type="button" className="mod-btn" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="notifications-read-all" onClick={() => onConfirmar(escolhido ? Number(escolhido) : null)}>
            Mudei de opinião
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Debate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dialog = useNotification();
  const [post, setPost] = useState(null);
  const [argumentos, setArgumentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [trocaPara, setTrocaPara] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setErro("");
      const { data } = await api.get(`/debates/${id}`);
      setPost(data.post);
      setArgumentos(data.argumentos || []);
    } catch (error) {
      setErro(error.response?.data?.erro || "Não foi possível abrir o debate.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeLado = (lado) => (lado === "a" ? post?.lado_a : post?.lado_b) || (lado === "a" ? "A favor" : "Contra");
  const minhaPosicao = post?.debate?.minha_posicao;

  async function registrarPosicao(lado, argumentoId = null) {
    try {
      const { data } = await api.post(`/debates/${id}/posicao`, { lado, argumento_id: argumentoId });
      setPost((atual) => ({ ...atual, debate: data.debate }));
      if (data.mudou) {
        dialog.notify({
          type: "success",
          title: "Você mudou de opinião",
          message: argumentoId
            ? "Registramos isso e avisamos quem escreveu o argumento que convenceu você."
            : "Registramos sua nova posição. Mudar de ideia também é participar.",
        });
      }
      carregar();
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível registrar", message: error.response?.data?.erro || "Tente novamente." });
    }
  }

  function escolher(lado) {
    if (minhaPosicao && minhaPosicao !== lado) setTrocaPara(lado);
    else registrarPosicao(lado);
  }

  async function publicarArgumento(e) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) return;
    const moderacao = analisarConteudo(conteudo);
    if (!moderacao.aprovado) {
      dialog.notify({ type: "warning", title: "Reformule seu argumento", message: moderacao.motivo });
      return;
    }
    try {
      setEnviando(true);
      const { data } = await api.post(`/debates/${id}/argumentos`, { texto: conteudo });
      setArgumentos(data.argumentos || []);
      setPost((atual) => ({ ...atual, debate: { ...atual.debate, total_argumentos: (data.argumentos || []).length } }));
      setTexto("");
    } catch (error) {
      dialog.notify({ type: "danger", title: "Argumento não publicado", message: error.response?.data?.erro || "Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  async function votar(argumento) {
    try {
      const { data } = await api.post(`/argumentos/${argumento.id}/voto`);
      // Recarrega para refletir o novo ranking (voto do outro lado vale o dobro).
      if (typeof data.votei === "boolean") carregar();
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível avaliar", message: error.response?.data?.erro || "Tente novamente." });
    }
  }

  async function apagar(argumento) {
    const ok = await dialog.confirm({ type: "danger", title: "Apagar argumento", message: "Seu argumento será removido do debate.", confirmText: "Apagar", cancelText: "Cancelar" });
    if (!ok) return;
    try {
      await api.delete(`/argumentos/${argumento.id}`);
      carregar();
    } catch (error) {
      dialog.notify({ type: "danger", title: "Não foi possível apagar", message: error.response?.data?.erro || "Tente novamente." });
    }
  }

  const abrirPerfil = (usuarioId) => usuarioId && navigate(`/perfil/${usuarioId}`);

  if (carregando) return <main className="notifications-page"><p className="notifications-loading">Abrindo debate...</p></main>;
  if (erro || !post) {
    return (
      <main className="notifications-page">
        <section className="notifications-card">
          <button className="explorar-voltar" onClick={() => navigate("/feed")}>← Voltar</button>
          <div className="notifications-error" role="alert">{erro || "Debate não encontrado."}</div>
        </section>
      </main>
    );
  }

  const candidatos = trocaPara ? argumentos.filter((arg) => arg.lado === trocaPara && !arg.meu).slice(0, 5) : [];

  return (
    <main className="notifications-page">
      <section className="notifications-card debate-pagina">
        <button className="explorar-voltar" onClick={() => navigate("/feed")}>← Voltar</button>

        <header className="debate-cabecalho">
          <span className="debate-selo">⚖️ Debate{post.tema ? ` · #${post.tema}` : ""}</span>
          <h1>{post.conteudo}</h1>
          <button type="button" className="arg-autor" onClick={() => abrirPerfil(post.usuario_id)}>
            <Avatar autor={{ nome: post.nome, foto: post.foto }} />
            <span>
              <strong>{post.nome}</strong>
              <small>abriu este debate · {formatarData(post.criado_em)}</small>
            </span>
          </button>
        </header>

        <DebatePlacar post={post} onEscolher={escolher} />

        <div className="debate-colunas">
          {["a", "b"].map((lado) => {
            const lista = argumentos.filter((arg) => arg.lado === lado);
            return (
              <section key={lado} className={`debate-coluna lado-${lado} ${minhaPosicao === lado ? "minha" : ""}`} aria-labelledby={`coluna-${lado}`}>
                <h2 id={`coluna-${lado}`}>{nomeLado(lado)} <small>{lista.length} {lista.length === 1 ? "argumento" : "argumentos"}</small></h2>

                {minhaPosicao === lado && (
                  <form className="arg-form" onSubmit={publicarArgumento}>
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value.slice(0, MAX_ARGUMENTO))}
                      placeholder={`Por que "${nomeLado(lado)}"? Traga razões, dados ou exemplos.`}
                      rows={3}
                      aria-label="Seu argumento"
                    />
                    <div>
                      <small>{texto.length}/{MAX_ARGUMENTO}</small>
                      <button type="submit" className="notifications-read-all" disabled={enviando || !texto.trim()}>
                        {enviando ? "Publicando..." : "Publicar argumento"}
                      </button>
                    </div>
                  </form>
                )}

                {lista.length === 0 ? (
                  <p className="debate-vazio">Ninguém argumentou por este lado ainda.</p>
                ) : (
                  lista.map((arg) => (
                    <CartaoArgumento key={arg.id} argumento={arg} onVotar={votar} onApagar={apagar} onAbrirPerfil={abrirPerfil} />
                  ))
                )}
              </section>
            );
          })}
        </div>
      </section>

      {trocaPara && (
        <ModalMudanca
          ladoNome={nomeLado(trocaPara)}
          candidatos={candidatos}
          onCancelar={() => setTrocaPara(null)}
          onConfirmar={(argumentoId) => {
            const lado = trocaPara;
            setTrocaPara(null);
            registrarPosicao(lado, argumentoId);
          }}
        />
      )}
    </main>
  );
}
