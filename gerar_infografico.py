from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Paleta ────────────────────────────────────────────────────────────────────
AZUL_ESCURO  = colors.HexColor("#0D2137")
AZUL_MEDIO   = colors.HexColor("#1A3A5C")
AZUL_CLARO   = colors.HexColor("#2E6DA4")
CIANO        = colors.HexColor("#00A8CC")
VERDE        = colors.HexColor("#27AE60")
CINZA_CLARO  = colors.HexColor("#F0F4F8")
CINZA_BORDA  = colors.HexColor("#CBD5E0")
BRANCO       = colors.white
TEXTO        = colors.HexColor("#1A202C")

PAGE_W, PAGE_H = A4

# ── Estilos ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def s(name, **kw):
    base = styles["Normal"]
    return ParagraphStyle(name, parent=base, **kw)

TITLE   = s("Title",   fontSize=22, textColor=BRANCO,     alignment=TA_CENTER,
            fontName="Helvetica-Bold", leading=28, spaceAfter=4)
SUBTITLE= s("Sub",     fontSize=11, textColor=CIANO,      alignment=TA_CENTER,
            fontName="Helvetica", leading=14, spaceAfter=2)
SECTION = s("Section", fontSize=13, textColor=BRANCO,     fontName="Helvetica-Bold",
            leading=16, spaceBefore=6, spaceAfter=4)
BODY    = s("Body",    fontSize=9,  textColor=TEXTO,      fontName="Helvetica",
            leading=13, spaceAfter=3)
BULLET  = s("Bullet",  fontSize=9,  textColor=TEXTO,      fontName="Helvetica",
            leading=13, leftIndent=12, spaceAfter=2)
CAPTION = s("Caption", fontSize=8,  textColor=colors.HexColor("#718096"),
            fontName="Helvetica-Oblique", alignment=TA_CENTER)
FOOTER  = s("Footer",  fontSize=7,  textColor=colors.HexColor("#A0AEC0"),
            fontName="Helvetica", alignment=TA_CENTER)

# ── Helpers ───────────────────────────────────────────────────────────────────

def section_header(text, color=AZUL_MEDIO):
    data = [[Paragraph(text, SECTION)]]
    t = Table(data, colWidths=[PAGE_W - 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), color),
        ("ROWPADDING", (0,0), (-1,-1), 7),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def info_box(items, bg=CINZA_CLARO):
    rows = [[Paragraph(f"▸  {item}", BULLET)] for item in items]
    t = Table(rows, colWidths=[PAGE_W - 4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("ROWPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, CINZA_BORDA),
    ]))
    return t


def cia_table():
    header = [
        Paragraph("Princípio", s("th", fontSize=9, fontName="Helvetica-Bold",
                                 textColor=BRANCO, alignment=TA_CENTER)),
        Paragraph("Implementação no Repositório BIM", s("th", fontSize=9,
                                 fontName="Helvetica-Bold", textColor=BRANCO, alignment=TA_CENTER)),
    ]
    rows = [
        ["Confidencialidade",
         "Acesso restrito ao proprietário + compartilhamento explícito com consentimento LGPD"],
        ["Integridade",
         "Hash Argon2id, JWT assinado, arquivos imutáveis após upload"],
        ["Disponibilidade",
         "Soft delete — arquivo desativado, nunca destruído; dados recuperáveis"],
    ]
    cell_style = s("td", fontSize=9, fontName="Helvetica", textColor=TEXTO, leading=12)
    label_style = s("label", fontSize=9, fontName="Helvetica-Bold",
                    textColor=BRANCO, alignment=TA_CENTER)

    label_colors = [AZUL_CLARO, VERDE, colors.HexColor("#E67E22")]
    table_data = [header]
    for i, (label, desc) in enumerate(rows):
        table_data.append([
            Paragraph(label, label_style),
            Paragraph(desc, cell_style),
        ])

    col_w = PAGE_W - 4*cm
    t = Table(table_data, colWidths=[col_w * 0.28, col_w * 0.72])
    style = TableStyle([
        ("BACKGROUND", (0,0), (-1,0), AZUL_ESCURO),
        ("ROWPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("GRID", (0,0), (-1,-1), 0.4, CINZA_BORDA),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ])
    for i, lc in enumerate(label_colors, start=1):
        style.add("BACKGROUND", (0, i), (0, i), lc)
    t.setStyle(style)
    return t


def lifecycle_table():
    steps = [
        ("1. Upload",       "Envio do arquivo BIM pelo proprietário (formatos permitidos, ≤ 200 MB)"),
        ("2. Armazenamento","Isolado por UUID do usuário no servidor; nome real substituído por UUID"),
        ("3. Compartilhamento","Proprietário indica matrícula do destinatário + consentimento LGPD"),
        ("4. Revogação",    "Proprietário remove acesso a qualquer momento; log registrado"),
        ("5. Soft Delete",  "Arquivo marcado como excluído — dados preservados para auditoria"),
    ]
    cell = s("td2", fontSize=9, fontName="Helvetica", textColor=TEXTO, leading=12)
    bold = s("bold", fontSize=9, fontName="Helvetica-Bold", textColor=AZUL_CLARO)
    col_w = PAGE_W - 4*cm
    data = [[Paragraph(e, bold), Paragraph(d, cell)] for e, d in steps]
    t = Table(data, colWidths=[col_w*0.22, col_w*0.78])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CINZA_CLARO),
        ("ROWPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, CINZA_BORDA),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    return t


def normas_table():
    items = [
        ("ISO/IEC 27001", "Gestão de segurança da informação — base para controles de acesso e auditoria"),
        ("LGPD — Lei 13.709/2018", "Proteção de dados pessoais — consentimento obrigatório no compartilhamento"),
        ("OWASP Top 10", "Prevenção de injeção, auth quebrada, exposição de dados — guia de implementação"),
        ("RFC 6238 (TOTP)", "Padrão aberto para autenticação de dois fatores baseada em tempo"),
        ("PHC — Argon2id", "Algoritmo vencedor do Password Hashing Competition para hash de credenciais"),
    ]
    cell = s("td3", fontSize=9, fontName="Helvetica", textColor=TEXTO, leading=12)
    bold = s("bold3", fontSize=9, fontName="Helvetica-Bold", textColor=AZUL_MEDIO)
    col_w = PAGE_W - 4*cm
    data = [[Paragraph(n, bold), Paragraph(d, cell)] for n, d in items]
    t = Table(data, colWidths=[col_w*0.32, col_w*0.68])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CINZA_CLARO),
        ("ROWPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, CINZA_BORDA),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    return t


# ── Documento ─────────────────────────────────────────────────────────────────

def build():
    path = "infografico_psi_bim.pdf"
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title="Política de Segurança da Informação — Repositório BIM",
    )

    story = []

    # ── Cabeçalho ────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph("Política de Segurança da Informação", TITLE),
        Paragraph("Repositório de Arquivos BIM", SUBTITLE),
    ]]
    header_table = Table(
        [[Paragraph("Política de Segurança da Informação", TITLE)],
         [Paragraph("Repositório de Arquivos BIM", SUBTITLE)],
         [Paragraph("Confidencialidade · Integridade · Disponibilidade · Conformidade LGPD", CAPTION)]],
        colWidths=[PAGE_W - 4*cm],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), AZUL_ESCURO),
        ("TOPPADDING",    (0,0), (-1,-1), 18),
        ("BOTTOMPADDING", (0,0), (-1,-1), 18),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.4*cm))

    # ── 1. Classificação da Informação ───────────────────────────────────────
    story.append(section_header("1 · Classificação da Informação"))
    story.append(Spacer(1, 0.2*cm))
    story.append(info_box([
        "Arquivos BIM (Building Information Modeling) são classificados como dados sensíveis de propriedade intelectual",
        "Formatos aceitos: .rvt, .ifc, .nwd, .nwc, .pln, .dwg, .dxf, .pdf — lista branca (allowlist), tudo mais é rejeitado",
        "Tamanho máximo por arquivo: 200 MB — delimita o escopo e reduz superfície de ataque",
        "Projetos de arquitetura contêm plantas, especificações e dados proprietários confidenciais",
    ]))
    story.append(Spacer(1, 0.35*cm))

    # ── 2. Tríade CIA ────────────────────────────────────────────────────────
    story.append(section_header("2 · Tríade CIA Aplicada ao Repositório BIM", AZUL_CLARO))
    story.append(Spacer(1, 0.2*cm))
    story.append(cia_table())
    story.append(Spacer(1, 0.35*cm))

    # ── 3. Autenticação ──────────────────────────────────────────────────────
    story.append(section_header("3 · Política de Autenticação e Identidade (IAM)"))
    story.append(Spacer(1, 0.2*cm))
    story.append(info_box([
        "Autenticação multifator obrigatória (MFA): senha + TOTP de 6 dígitos (RFC 6238)",
        "Hash de senha: Argon2id com salt único de 32 bytes por usuário — resistente a ataques de GPU e rainbow tables",
        "Token temporário pré-2FA: JWT com TTL de 5 minutos e claim stage: pre_2fa",
        "Token de acesso final: JWT com TTL de 60 minutos — stateless, expiração automática",
        "Proteção contra enumeração de usuários: respostas e tempo de resposta idênticos para e-mails válidos e inválidos",
    ]))
    story.append(Spacer(1, 0.35*cm))

    # ── 4. Controle de Acesso ────────────────────────────────────────────────
    story.append(section_header("4 · Controle de Acesso e Princípio do Menor Privilégio", AZUL_CLARO))
    story.append(Spacer(1, 0.2*cm))
    story.append(info_box([
        "Cada arquivo possui um único proprietário — acesso cruzado implícito não existe",
        "Compartilhamento granular: permissão restrita a download, controlada exclusivamente pelo dono",
        "Revogação de acesso imediata — proprietário pode encerrar qualquer compartilhamento a qualquer momento",
        "Identificação por matrícula: destinatário do compartilhamento deve ser usuário cadastrado no sistema",
        "Sem acesso administrativo global a arquivos de outros usuários",
    ]))
    story.append(Spacer(1, 0.35*cm))

    # ── 5. LGPD ──────────────────────────────────────────────────────────────
    story.append(section_header("5 · Conformidade com a LGPD — Lei 13.709/2018"))
    story.append(Spacer(1, 0.2*cm))
    story.append(info_box([
        "Compartilhamento requer consentimento explícito do proprietário (campo lgpd_consent obrigatório)",
        "Data e hora do consentimento são registradas no banco de dados (lgpd_consent_at)",
        "Revogação de compartilhamento a qualquer momento — direito ao esquecimento parcial garantido",
        "Dados de identificação (e-mail, matrícula, nome) usados apenas para finalidade declarada",
    ]))
    story.append(Spacer(1, 0.35*cm))

    # ── 6. Auditoria ─────────────────────────────────────────────────────────
    story.append(section_header("6 · Rastreabilidade e Auditoria", AZUL_CLARO))
    story.append(Spacer(1, 0.2*cm))
    story.append(info_box([
        "Log de acesso registrado para cada operação: upload, download, compartilhamento, revogação e exclusão",
        "Cada entrada contém: identificador do arquivo, identificador do usuário, ação e timestamp UTC",
        "Não repúdio: toda ação é atribuída a um usuário autenticado e registrada de forma imutável",
        "Base para investigação de incidentes de segurança e auditorias de conformidade",
    ]))
    story.append(Spacer(1, 0.35*cm))

    # ── 7. Ciclo de Vida ─────────────────────────────────────────────────────
    story.append(section_header("7 · Ciclo de Vida dos Arquivos BIM"))
    story.append(Spacer(1, 0.2*cm))
    story.append(lifecycle_table())
    story.append(Spacer(1, 0.35*cm))

    # ── 8. Normas e Referências ───────────────────────────────────────────────
    story.append(section_header("8 · Normas e Referências Aplicáveis", AZUL_CLARO))
    story.append(Spacer(1, 0.2*cm))
    story.append(normas_table())
    story.append(Spacer(1, 0.4*cm))

    # ── Rodapé ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=CINZA_BORDA))
    story.append(Spacer(1, 0.15*cm))
    story.append(Paragraph(
        "Repositório BIM — Política de Segurança da Informação  |  "
        "Uso interno — Escritório de Arquitetura e Urbanismo  |  2026",
        FOOTER
    ))

    doc.build(story)
    print(f"PDF gerado: {path}")


if __name__ == "__main__":
    build()
