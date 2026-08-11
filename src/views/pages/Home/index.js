import { Layout } from "views/components";
import { Link } from "react-router-dom";

import "./index.css";

export const Home = () => {
  return (
    <Layout>
      <main className="home">
        <section className="home-hero">
          <div className="home-copy">
            <span className="home-kicker">ASSISTENTE PESSOAL AUTÔNOMO</span>
            <h1>Transforme pedidos em ações reais.</h1>
            <p>Converse com o Atto para consultar serviços, executar rotinas e acompanhar trabalhos de desenvolvimento do início até a pull request.</p>
            <div className="home-actions">
              <Link className="home-primary-action" to="/use">Começar agora <span>→</span></Link>
              <a className="home-secondary-action" href="#capabilities">Conhecer recursos</a>
            </div>
          </div>
          <div className="home-preview" aria-label="Exemplo de execução do Atto">
            <div className="home-preview-top"><span className="home-preview-orb">A</span><div><strong>Atto Agent</strong><small><i /> Pronto para ajudar</small></div></div>
            <div className="home-preview-message user">Prepare minha daily usando os commits de hoje.</div>
            <div className="home-preview-steps"><span>✓</span><div><strong>Contexto identificado</strong><small>Azure DevOps · Daily</small></div></div>
            <div className="home-preview-message agent">Daily gerada com as entregas e atividades em andamento.</div>
          </div>
        </section>

        <section className="home-capabilities" id="capabilities">
          <article><span>01</span><h2>Converse naturalmente</h2><p>Peça por voz ou texto, sem precisar memorizar comandos técnicos.</p></article>
          <article><span>02</span><h2>Execute integrações</h2><p>Acione APIs e rotinas usando credenciais protegidas no servidor.</p></article>
          <article><span>03</span><h2>Acompanhe o trabalho</h2><p>Veja cada etapa em tempo real e repita solicitações com Rerun.</p></article>
        </section>
      </main>
    </Layout>
  );
};
