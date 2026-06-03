# Resumo Científico

**Projeto Integrador — Políticas de Segurança da Informação**
**Título:** Repositório Seguro de Arquivos BIM com Autenticação Multifator e Conformidade com a LGPD

---

Este trabalho apresenta o desenvolvimento de um sistema web para armazenamento e compartilhamento controlado de arquivos BIM (*Building Information Modeling*), com foco em segurança da informação e conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). O objetivo é prover a profissionais de Arquitetura e Urbanismo uma plataforma segura para gestão de projetos digitais, eliminando os riscos associados ao compartilhamento por canais não protegidos.

A metodologia adotou uma arquitetura em camadas com backend em Python/FastAPI e frontend em React/Vite, utilizando PostgreSQL para persistência e Supabase Storage para armazenamento de arquivos. O processo de autenticação implementa dois fatores (2FA): verificação de credenciais com hash Argon2id (vencedor do *Password Hashing Competition*, 2015) e validação de código TOTP (*Time-based One-Time Password*) conforme RFC 6238. Os parâmetros do Argon2id foram configurados seguindo as diretrizes OWASP 2024 (time_cost=3, memory_cost=64 MiB), tornando ataques por força bruta computacionalmente inviáveis.

Os mecanismos de segurança implementados incluem: salt criptográfico único de 256 bits por usuário; tokens JWT com expiração e blocklist de invalidação; proteção contra força bruta via rate limiting por IP; criptografia de dados em repouso com AES-256-GCM; e trigger PostgreSQL que impede a alteração ou exclusão de registros de auditoria. A recuperação de senha utiliza tokens de 256 bits com expiração de 15 minutos e armazenamento apenas do hash SHA-256, sem exposição do valor original.

Em conformidade com a LGPD, o sistema registra consentimento explícito com data e versão no cadastro e em cada compartilhamento, implementa os direitos do titular previstos no Art. 18 (acesso, exportação, revogação de consentimento e exclusão de conta com anonimização dos logs), e aplica o princípio da minimização coletando apenas dados estritamente necessários à funcionalidade.

**Palavras-chave:** segurança da informação; autenticação multifator; Argon2id; LGPD; BIM; criptografia.
