import React, { useState } from 'react';
import { 
  Button, 
  Container, 
  Typography, 
  Box, 
  Paper, 
  CircularProgress,
  Fade,
  Zoom,
  // useTheme,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import { styled } from '@mui/material/styles';
import mqtt from 'mqtt';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

// Tema personalizado
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

const StyledButton = styled(Button)(({ theme }) => ({
  margin: theme.spacing(1),
  padding: theme.spacing(2),
  width: '100%',
  maxWidth: '280px',
  fontSize: '1rem',
  fontWeight: 500,
  textTransform: 'none',
  borderRadius: '10px',
  boxShadow: theme.shadows[2],
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)',
  },
}));

const StatusIndicator = styled('div')(({ status, theme }) => ({
  display: 'inline-block',
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  marginRight: '8px',
  backgroundColor: status === 'Conectado' ? '#4caf50' : 
                 status === 'Conectando...' ? '#ffc107' : '#f44336',
  boxShadow: `0 0 10px ${status === 'Conectado' ? 'rgba(76, 175, 80, 0.7)' : 
               status === 'Conectando...' ? 'rgba(255, 193, 7, 0.7)' : 'rgba(244, 67, 54, 0.7)'}`,
  transition: 'all 0.3s ease',
}));

function App() {
  const [status, setStatus] = useState('Desconectado');
  const [currentAngle, setCurrentAngle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();
  
  // Configuración para HiveMQ Cloud Serverless
  const mqttOptions = {
    host: '51e714b72522419fb79f9d2dd4091edb.s1.eu.hivemq.cloud',
    port: 8884,
    protocol: 'wss',
    path: '/mqtt',
    username: 'inakiechaide',
    password: 'Foreverkuki1201',
    clientId: 'web-client-' + Math.random().toString(16).substr(2, 8),
    clean: true,
    connectTimeout: 10 * 1000,
    reconnectPeriod: 2000,
    protocolVersion: 5,
    keepalive: 60,
    resubscribe: true,
    properties: {
      sessionExpiryInterval: 3600,
      receiveMaximum: 20,
      maximumPacketSize: 100 * 1024
    }
  };

  const sendAngle = (angle) => {
    setStatus('Conectando...');
    setIsLoading(true);
    
    try {
      const client = mqtt.connect(mqttOptions);
      
      client.on('connect', () => {
        console.log('Conectado al broker MQTT');
        setStatus('Enviando comando...');
        
        client.publish('motor/angle', angle.toString(), { qos: 1 }, (err) => {
          if (err) {
            console.error('Error al publicar:', err);
            setStatus('Error al enviar');
          } else {
            console.log('Mensaje enviado');
            setCurrentAngle(angle);
            setStatus('Comando enviado correctamente');
          }
          setIsLoading(false);
          client.end();
        });
      });

      client.on('error', (err) => {
        console.error('Error de conexión:', err);
        setStatus(`Error: ${err.message}`);
        setIsLoading(false);
        client.end();
      });

      const timeout = setTimeout(() => {
        if (client.connected === false) {
          console.error('Tiempo de espera agotado');
          setStatus('Tiempo de espera agotado');
          setIsLoading(false);
          client.end();
        }
      }, 10000);
      
      client.on('connect', () => clearTimeout(timeout));
      
    } catch (error) {
      console.error('Error en sendAngle:', error);
      setStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  const getButtonVariant = (angle) => {
    if (currentAngle === angle) return 'contained';
    return 'outlined';
  };

  const getButtonColor = (angle) => {
    switch(angle) {
      case 0: return 'error';
      case 30: return 'warning';
      case 90: return 'info';
      case 180: return 'success';
      default: return 'primary';
    }
  };

  const getButtonIcon = (angle) => {
    switch(angle) {
      case 0: return <PowerSettingsNewIcon sx={{ mr: 1 }} />;
      case 30: return <NightsStayIcon sx={{ mr: 1 }} />;
      case 90: return <SettingsIcon sx={{ mr: 1 }} />;
      case 180: return <WbSunnyIcon sx={{ mr: 1 }} />;
      default: return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Fade in={true} timeout={800}>
          <Box>
            <Box textAlign="center" mb={4}>
              <Typography 
                variant="h4" 
                component="h1" 
                fontWeight={600} 
                color="primary"
                gutterBottom
              >
                Control de Motor
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="textSecondary"
                gutterBottom
              >
                Panel de control remoto
              </Typography>
            </Box>
            
            <Zoom in={true} style={{ transitionDelay: '200ms' }}>
              <Paper 
                elevation={4} 
                sx={{ 
                  p: 3, 
                  mb: 4, 
                  borderRadius: 3,
                  background: 'linear-gradient(145deg, #ffffff, #f0f0f0)'
                }}
              >
                <Box display="flex" alignItems="center" mb={2}>
                  <StatusIndicator status={status} />
                  <Typography variant="subtitle1" color="textSecondary">
                    {status}
                  </Typography>
                </Box>
                
                {currentAngle !== null && (
                  <Box 
                    textAlign="center" 
                    py={2}
                    sx={{
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      borderRadius: 2,
                      mb: 2
                    }}
                  >
                    <Typography variant="h3" component="div" color="primary">
                      {currentAngle}°
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Ángulo actual
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Zoom>

            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center"
              gap={2}
            >
              {[0, 30, 90, 180].map((angle) => (
                <Zoom 
                  key={angle}
                  in={true} 
                  style={{ 
                    transitionDelay: `${100 * (angle / 30 + 1)}ms`,
                    width: '100%',
                    maxWidth: 320
                  }}
                >
                  <Box width="100%">
                    <StyledButton 
                      variant={getButtonVariant(angle)}
                      color={getButtonColor(angle)}
                      onClick={() => sendAngle(angle)}
                      disabled={isLoading}
                      startIcon={getButtonIcon(angle)}
                      sx={{
                        justifyContent: 'flex-start',
                        pl: 3,
                        '& .MuiButton-startIcon': {
                          marginRight: 2
                        }
                      }}
                    >
                      <Box textAlign="left">
                        <Box fontWeight={600}>
                          {angle === 0 && 'Apagado'}
                          {angle === 30 && 'Modo Piloto'}
                          {angle === 90 && 'Mínimo'}
                          {angle === 180 && 'Máximo'}
                        </Box>
                        <Box fontSize="0.8rem" opacity={0.8}>
                          {angle}°
                        </Box>
                      </Box>
                      <Box flexGrow={1} />
                      {isLoading && currentAngle === angle ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : null}
                    </StyledButton>
                  </Box>
                </Zoom>
              ))}
            </Box>
            
            <Box mt={4} textAlign="center">
              <Typography variant="caption" color="textSecondary">
                Conexión segura · {new Date().getFullYear()}
              </Typography>
            </Box>
          </Box>
        </Fade>
      </Container>
    </ThemeProvider>
  );
}

export default App;
