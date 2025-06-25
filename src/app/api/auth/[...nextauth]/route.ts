import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/',
    error: '/login', // will show error message in the login page
  },
  callbacks: {
    async signIn({ user }) {
      // Removido o filtro de e-mail para permitir qualquer login para fins de teste.
      // Se necessário, adicione uma lógica de autorização mais robusta aqui.
      return true;
    },
    async jwt({ token }) {
      return token;
    },
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
