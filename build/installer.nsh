!define MUI_BGCOLOR "101014"
!define MUI_TEXTCOLOR "F1EFF6"
!define MUI_INSTFILESPAGE_COLORS "C6ABFF 101014"
!define MUI_WELCOMEPAGE_TITLE "Luma Launcher"
LangString LumaWelcome 1033 "Your world. Your rules.$\r$\n$\r$\nMinecraft Java Edition, your instances and mods — all in one place.$\r$\n$\r$\nChoose an installation folder and start your next adventure. Your worlds and settings are preserved when updating."
LangString LumaWelcome 1049 "Твой мир. Твои правила.$\r$\n$\r$\nMinecraft Java Edition, твои сборки и моды — всё в одном месте.$\r$\n$\r$\nВыбери папку установки и начни новое приключение. При обновлении миры и настройки сохранятся."
!define MUI_WELCOMEPAGE_TEXT "$(LumaWelcome)"
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
