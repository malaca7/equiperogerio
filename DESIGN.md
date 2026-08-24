---
name: 7Locar / Equipe Rogerio - Premium Design System
version: 3.0.0
colors:
  primary: "#16a34a"
  primary-hover: "#15803d"
  primary-glow: "rgba(34, 197, 94, 0.25)"
  background-dark: "#0A0A0A"
  background-card: "#121212"
  background-popover: "#171717"
  border-subtle: "rgba(255, 255, 255, 0.08)"
  border-hover: "rgba(255, 255, 255, 0.12)"
  text-primary: "#FAFAFA"
  text-secondary: "#A1A1AA"
  text-muted: "#71717A"
  status-present: "#22C55E"
  status-warning: "#F59E0B"
  status-absent: "#EF4444"
  status-info: "#3B82F6"
typography:
  fontFamily: "Inter, SF Pro Display, system-ui, -apple-system, sans-serif"
  display:
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  h1:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h2:
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  h3:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  card:
    backgroundColor: "{colors.background-card}"
    rounded: "{rounded.lg}"
    border: "{colors.border-subtle}"
    padding: "20px"
    shadow: "0 1px 3px rgba(0,0,0,0.1)"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  badge-present:
    backgroundColor: "rgba(34, 197, 94, 0.12)"
    textColor: "{colors.status-present}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# 7Locar / Gestão de Equipes — Design Specification (v3.0)

## Overview
Esta especificação define o **Design System Premium** para a plataforma corporativa da Gestão de Equipes Rogério / 7Locar.
A estética foi projetada com foco em **minimalismo, sofisticação e precisão técnica**, adotando referências visuais do ecossistema Apple/macOS e plataformas modernas como Linear/Vercel.

## Principais Pilares
1. **Identidade Visual Refinada**: A cor primária é o **Verde Institucional**, contrastando com superfícies de fundo neutras (claras no Light Mode e escuras no Dark Mode).
2. **Minimalismo Nativo (Apple/Linear)**:
   - Uso de bordas finas e precisas.
   - Sombras subtis (drop shadows leves) em vez de Glassmorphism exagerado.
   - Focos visuais limpos usando estados de `:hover` com variações sutis no fundo.
3. **Tipografia Premium**: 
   - Adoção das fontes `Inter` e `SF Pro Display`.
   - Hierarquia de texto nítida com letras mais limpas e sem excessos decorativos.
4. **Sistema de Cores**:
   - 🟢 **Verde Institucional (`#16a34a`)**: Ações primárias, botões, seleção e badges de sucesso.
   - 🟡 **Âmbar (`#f59e0b`)**: Alertas e atenção.
   - 🔴 **Vermelho Rosa (`#ef4444`)**: Faltas e ações destrutivas.
5. **Navegação (Sidebar/Topbar)**:
   - Sidebar retrátil redesenhada para parecer um painel nativo do macOS, sem a distração de múltiplas cores primárias por módulo. Todos os ícones interativos compartilham a mesma identidade visual verde.
   - TopHeader limpo, com botões discretos de contexto (Perfil, Configurações).

## Diretrizes de Uso (Do's and Don'ts)
- **Do**: Utilizar `shadow-sm` para cards e botões no Light Theme para garantir separação de superfície.
- **Do**: Usar `text-muted-foreground` para ícones de ação inativos e trocar para a cor de destaque (foreground ou primary) apenas no hover ou estado ativo.
- **Don't**: Não aplicar efeitos de `neon` excessivos ou cores saturadas vibrantes (ex: o azul/roxo anterior) fora das badges de status.
- **Don't**: Evitar criar elementos novos que não estejam presentes nos tokens básicos de cor (primary, background, surface, etc).
