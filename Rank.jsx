import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';

const Rank = () => {
  const [users, setUsers] = useState([]); //userのデータをとってきてる

  useEffect(() => {
    //とってきたデータを昇順＋5番以内にしている
    const fetchData = async () => {
      const q = query(collection(db, 'users'), orderBy('time'), limit(5));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(data);
    };
    fetchData();
  }, []);

  const formatScore = (scoreInSeconds) => {
    //タイムを分と秒に変えている
    const minutes = Math.floor(scoreInSeconds / 60);
    const seconds = scoreInSeconds % 60;
    return `${minutes}分${seconds}秒`;
  };

  const getCardStyle = (index) => {
    //ランキングのカードのスタイル
    switch (index) {
      case 0:
        return { border: '3px solid #FFD700', backgroundColor: '#FFF9E3' };
      case 1:
        return { border: '3px solid #C0C0C0', backgroundColor: '#F5F5F5' };
      case 2:
        return { border: '3px solid #CD7F32', backgroundColor: '#FDF1E0' };
      default:
        return { border: '1px solid #ddd', backgroundColor: '#fff' };
    }
  };

  const styles = {
    //スタイル
    container: {
      maxWidth: '800px',
      margin: '20px auto',
      padding: '20px',
    },
    title: {
      textAlign: 'center',
      marginBottom: '20px',
      fontSize: '24px',
    },
    cardContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '30px',
      alignItems: 'center',
    },
    card: {
      width: '300px',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      textAlign: 'center',
      transition: 'transform 0.3s',
    },
    rank: {
      fontSize: '28px',
      fontWeight: 'bold',
      marginBottom: '10px',
    },
    name: {
      fontSize: '18px',
      marginBottom: '5px',
    },
    score: {
      fontSize: '16px',
      color: '#555',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>クリアタイム (Top 5)</h1>

      <div style={styles.cardContainer}>
        {users.map(
          (
            user,
            index //ランキングの表示
          ) => (
            <motion.div
              key={user.id}
              style={{ ...styles.card, ...getCardStyle(index) }}
              initial={{ x: 130, opacity: 0 }}
              animate={{ x: 10, opacity: 1 }}
              transition={{
                delay: index * 0.5,
                type: 'spring',
                stiffness: 100,
              }}
            >
              <div style={styles.rank}>{index + 1}位</div>
              <div style={styles.name}>{user.name} さん</div>
              <div style={styles.time}>タイム: {formatScore(user.time)}</div>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
};

export default Rank;
