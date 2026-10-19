const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    const usuariosSnapshot = await db.collection('usuarios').where('planosAtivos', '!=', []).get();
    let totalCreditadoGeral = 0;
    let usuariosAfetados = 0;

    for (const doc of usuariosSnapshot.docs) {
      const u = doc.data();
      const planos = u.planosAtivos || [];
      let totalCreditadoUser = 0;
      let planosAtualizados = [];
      const agora = Date.now();

      for (const p of planos) {
        const ultimoCredito = p.ultimoCredito || p.dataInicio_timestamp || (agora - 24*60*60*1000);
        const dias = Math.floor((agora - ultimoCredito) / (24*60*60*1000));
        
        if (dias > 0) {
          totalCreditadoUser += (p.diario * dias);
          p.ganhoTotal = (p.ganhoTotal || 0) + (p.diario * dias);
          p.ultimoCredito = agora;
        }
        planosAtualizados.push(p);
      }

      if (totalCreditadoUser > 0) {
        const novoSaldo = u.saldo + totalCreditadoUser;
        const novoGanhos = (u.ganhosHoje || 0) + totalCreditadoUser;
        
        await db.collection('usuarios').doc(doc.id).update({
          saldo: novoSaldo,
          ganhosHoje: novoGanhos,
          planosAtivos: planosAtualizados,
          ultimoCreditoGlobal: agora
        });
        
        totalCreditadoGeral += totalCreditadoUser;
        usuariosAfetados++;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ success: true, usuariosAfetados, totalCreditadoGeral }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

// ⏰ AGENDAMENTO: 14:00 UTC = 15:00 em Angola
exports.config = {
  schedule: "0 14 * * *" 
};
