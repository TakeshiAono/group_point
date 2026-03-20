import type { NextAuthConfig } from "next-auth";

// Edge Runtime対応のミドルウェア専用設定（Prismaを使わない）
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
