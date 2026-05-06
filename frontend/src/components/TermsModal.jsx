import { X } from 'lucide-react'

export default function TermsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Termos de Uso e Política de Privacidade</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="modal-body">
          <p className="terms-updated">Última atualização: maio de 2026</p>

          <section className="terms-section">
            <h4>1. Sobre o sistema</h4>
            <p>
              O Repositório BIM é um sistema acadêmico destinado exclusivamente a alunos
              regularmente matriculados na instituição. Seu objetivo é armazenar, organizar e
              facilitar o compartilhamento controlado de projetos em formato BIM (Building
              Information Modeling) entre membros da comunidade universitária.
            </p>
          </section>

          <section className="terms-section">
            <h4>2. Propriedade intelectual</h4>
            <p>
              Todo arquivo enviado permanece de propriedade intelectual do seu autor, nos
              termos da Lei nº 9.610/1998 (Lei de Direitos Autorais). O sistema não reivindica
              nenhum direito sobre os conteúdos armazenados.
            </p>
            <p>
              Ao compartilhar um arquivo com outro usuário, você concede a esse usuário uma
              licença de visualização e/ou download de uso pessoal e não comercial, sem
              transferência de titularidade. Você pode revogar esse acesso a qualquer momento.
            </p>
            <p>
              É proibido enviar arquivos de terceiros sem autorização expressa do autor.
            </p>
          </section>

          <section className="terms-section">
            <h4>3. Proteção de dados — LGPD (Lei nº 13.709/2018)</h4>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados Pessoais, informamos:
            </p>
            <ul>
              <li>
                <strong>Dados coletados:</strong> nome completo, matrícula, curso, e-mail e
                arquivos BIM enviados por você.
              </li>
              <li>
                <strong>Finalidade:</strong> autenticação, organização do repositório e
                compartilhamento acadêmico entre alunos da instituição.
              </li>
              <li>
                <strong>Base legal:</strong> legítimo interesse acadêmico e consentimento
                informado (art. 7º, I e IX, LGPD).
              </li>
              <li>
                <strong>Compartilhamento:</strong> seus dados e arquivos nunca serão
                compartilhados com terceiros fora da instituição sem sua autorização.
              </li>
              <li>
                <strong>Seus direitos:</strong> você pode, a qualquer momento, solicitar
                acesso, correção ou exclusão dos seus dados e arquivos.
              </li>
              <li>
                <strong>Retenção:</strong> os dados são mantidos enquanto a conta estiver
                ativa. Após exclusão da conta, os dados são removidos em até 30 dias.
              </li>
            </ul>
          </section>

          <section className="terms-section">
            <h4>4. Uso aceitável</h4>
            <ul>
              <li>O sistema é de uso exclusivo para fins acadêmicos.</li>
              <li>É proibido o envio de conteúdo ilícito, ofensivo ou que viole direitos de terceiros.</li>
              <li>O compartilhamento de credenciais de acesso é expressamente proibido.</li>
              <li>O sistema registra logs de acesso para fins de segurança e auditoria.</li>
            </ul>
          </section>

          <section className="terms-section">
            <h4>5. Segurança</h4>
            <p>
              As senhas são armazenadas com hash Argon2id e salt único. O acesso requer
              autenticação em duas etapas (2FA via TOTP). Todos os acessos a arquivos são
              registrados em log de auditoria.
            </p>
          </section>

          <section className="terms-section">
            <h4>6. Contato</h4>
            <p>
              Para exercer seus direitos como titular de dados ou reportar incidentes, entre
              em contato com a administração do sistema.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose} style={{ marginTop: 0 }}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
