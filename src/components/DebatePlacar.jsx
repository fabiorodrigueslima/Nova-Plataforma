import { FiCheck } from "react-icons/fi";

// Barra com a proporção de cada lado e os botões para tomar posição.
export default function DebatePlacar({ post, onEscolher, desabilitado = false }) {
  const debate = post.debate || { total_a: 0, total_b: 0, minha_posicao: null };
  const total = debate.total_a + debate.total_b;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const pctA = pct(debate.total_a);
  const pctB = total ? 100 - pctA : 0;
  const lados = [
    { id: "a", nome: post.lado_a || "A favor", votos: debate.total_a, pct: pctA },
    { id: "b", nome: post.lado_b || "Contra", votos: debate.total_b, pct: pctB },
  ];

  return (
    <div className="debate-placar">
      <div className="debate-barra" role="img" aria-label={`${lados[0].nome}: ${pctA}%, ${lados[1].nome}: ${pctB}%`}>
        <span className="lado-a" style={{ width: total ? `${pctA}%` : "50%" }} />
        <span className="lado-b" style={{ width: total ? `${pctB}%` : "50%" }} />
      </div>
      <div className="debate-lados">
        {lados.map((lado) => {
          const meu = debate.minha_posicao === lado.id;
          return (
            <button
              key={lado.id}
              type="button"
              className={`debate-lado lado-${lado.id} ${meu ? "escolhido" : ""}`}
              onClick={() => onEscolher(lado.id)}
              disabled={desabilitado || meu}
              aria-pressed={meu}
            >
              <span className="debate-lado-nome">
                {meu && <FiCheck aria-hidden="true" />} {lado.nome}
              </span>
              <span className="debate-lado-num">
                {total ? `${lado.pct}%` : "—"} <small>· {lado.votos} {lado.votos === 1 ? "pessoa" : "pessoas"}</small>
              </span>
            </button>
          );
        })}
      </div>
      {!debate.minha_posicao && <p className="debate-dica">Escolha um lado para participar do debate.</p>}
    </div>
  );
}
