FROM denoland/deno:latest
# denoのデフォルト環境変数がhomeディレクトリ以下なので作成する
RUN mkdir -p /home/deno && chown -R deno:deno /home/deno
ENV PLAYWRIGHT_BROWSERS_PATH=/home/deno/.cache/ms-playwright
WORKDIR /home/deno/app

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && deno upgrade

# rootが必要なためdenoユーザーで実行しない
RUN deno run --allow-env --allow-sys --allow-read --allow-run --allow-write npm:playwright install chromium-headless-shell --with-deps

# /deno-dir はDeno が提供するデフォルトのキャッシュディレクトリです
# 最初に root 権限で Deno コマンドを実行した時点で root ユーザー所有のディレクトリやファイルが作成される
# その後、一般ユーザー（この場合は `deno` ユーザー）で Deno を実行すると、
# root 所有のディレクトリには書き込み権限がないため、`Permission denied (os error 13)` が発生します
RUN chown -R deno:deno /deno-dir && chown -R deno:deno /home/deno/app
USER deno
