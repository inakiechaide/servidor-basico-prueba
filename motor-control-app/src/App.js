import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Button, 
  Container, 
  Typography, 
  Box, 
  Paper, 
  CircularProgress,
  Fade,
  Zoom,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import mqtt from 'mqtt';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

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
  const [espStatus, setEspStatus] = useState('desconectado');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [events, setEvents] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  const mqttClient = useRef(null);
  
  const mqttOptions = useMemo(() => ({
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
  }), []);

  const handleFeedback = React.useCallback((data) => {
    const timestamp = new Date().toLocaleTimeString();
    const newEvent = {
      timestamp,
      status: data.status,
      message: data.message,
      device: data.device || 'esp32-servo'
    };
    
    // Actualizar estado del ESP32
    if (data.status === 'connected') {
      setEspStatus('conectado');
      showSnackbar('ESP32 conectado correctamente', 'success');
    } else if (data.status === 'disconnected') {
      setEspStatus('desconectado');
      showSnackbar('ESP32 desconectado', 'warning');
    } else if (data.status === 'success') {
      // Extraer el ángulo del mensaje de éxito
      const angleMatch = data.message.match(/Servo movido a (\d+)/);
      if (angleMatch) {
        setCurrentAngle(parseInt(angleMatch[1]));
      }
    }
    
    // Agregar a eventos recientes (mantener solo los últimos 10)
    setEvents(prev => [newEvent, ...prev].slice(0, 10));
    setLastUpdate(timestamp);
  }, [showSnackbar]);
  
  const showSnackbar = React.useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);
  
  const connectToMqtt = React.useCallback(() => {
    setStatus('Conectando...');
    
    try {
      mqttClient.current = mqtt.connect(mqttOptions);
      
      mqttClient.current.on('connect', () => {
        console.log('Conectado al broker MQTT');
        setStatus('Conectado');
        
        // Suscribirse al topic de feedback
        mqttClient.current.subscribe('motor/feedback', { qos: 1 }, (err) => {
          if (err) {
            console.error('Error al suscribirse a motor/feedback:', err);
            showSnackbar('Error al suscribirse a actualizaciones', 'error');
          } else {
            console.log('Suscrito a motor/feedback');
          }
        });
      });
      
      mqttClient.current.on('message', (topic, message) => {
        if (topic === 'motor/feedback') {
          try {
            const data = JSON.parse(message.toString());
            handleFeedback(data);
          } catch (error) {
            console.error('Error al procesar mensaje:', error);
          }
        }
      });
      
      mqttClient.current.on('error', (err) => {
        console.error('Error de conexión MQTT:', err);
        setStatus(`Error: ${err.message}`);
        showSnackbar(`Error de conexión: ${err.message}`, 'error');
      });
      
      mqttClient.current.on('reconnect', () => {
        console.log('Reconectando al broker MQTT...');
        setStatus('Reconectando...');
      });
      
      mqttClient.current.on('offline', () => {
        console.log('Desconectado del broker MQTT');
        setStatus('Desconectado');
        setEspStatus('desconectado');
      });
      
    } catch (error) {
      console.error('Error al conectar con MQTT:', error);
      setStatus(`Error: ${error.message}`);
      showSnackbar(`Error al conectar: ${error.message}`, 'error');
    }
  }, [handleFeedback, showSnackbar]);

  // Inicializar conexión MQTT al cargar el componente
  useEffect(() => {
    connectToMqtt();
    
    // Limpiar al desmontar
    return () => {
      if (mqttClient.current) {
        mqttClient.current.end();
      }
    };
  }, [connectToMqtt]);

  const sendAngle = (angle) => {
    if (!mqttClient.current || !mqttClient.current.connected) {
      showSnackbar('No hay conexión con el servidor', 'error');
      return;
    }
    
    setIsLoading(true);
    setStatus('Enviando comando...');
    
    try {
      mqttClient.current.publish('motor/angle', angle.toString(), { qos: 1 }, (err) => {
        if (err) {
          console.error('Error al publicar:', err);
          setStatus('Error al enviar');
          showSnackbar('Error al enviar comando', 'error');
        } else {
          console.log('Comando de ángulo enviado');
          setStatus('Comando enviado');
          showSnackbar(`Comando enviado: ${angle}°`, 'success');
        }
        setIsLoading(false);
      });
      
      // Timeout para operación de publicación
      const timeout = setTimeout(() => {
        setIsLoading(false);
        setStatus('Esperando confirmación...');
      }, 5000);
      
      return () => clearTimeout(timeout);
      
    } catch (error) {
      console.error('Error en sendAngle:', error);
      setStatus(`Error: ${error.message}`);
      showSnackbar(`Error: ${error.message}`, 'error');
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

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
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

  const renderStatusChip = (status) => {
    const statusMap = {
      'conectado': { label: 'Conectado', color: 'success' },
      'desconectado': { label: 'Desconectado', color: 'error' },
      'conectando': { label: 'Conectando...', color: 'warning' }
    };
    
    const statusInfo = statusMap[status] || { label: 'Desconocido', color: 'default' };
    
    return (
      <Chip 
        label={statusInfo.label}
        color={statusInfo.color}
        size="small"
        sx={{ ml: 1, fontWeight: 'medium' }}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
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
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" color="textSecondary">
                  Estado: 
                </Typography>
                {renderStatusChip(espStatus)}
                <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                  {lastUpdate && `Última actualización: ${lastUpdate}`}
                </Typography>
              </Box>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Panel de control remoto
              </Typography>
            </Box>
            

            


            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center"
              gap={2}
              mb={3}
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

            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2, width: '100%', maxWidth: 320 }}>
              <Typography variant="h6" gutterBottom>
                Estado del Sistema
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Conexión MQTT:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <StatusIndicator status={status} />
                  <Typography variant="body2">{status}</Typography>
                </Box>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Estado del Motor:</Typography>
                <Typography variant="body2">
                  {currentAngle !== null ? `Posición: ${currentAngle}°` : 'Posición desconocida'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Última acción:</Typography>
                <Typography variant="body2">
                  {lastUpdate || 'Ninguna registrada'}
                </Typography>
              </Box>
            </Paper>

            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <EventIcon sx={{ mr: 1 }} />
                Eventos Recientes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {events.length > 0 ? (
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {events.map((event, index) => (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {event.status === 'success' && <CheckCircleOutlineIcon color="success" sx={{ mr: 1, fontSize: 16 }} />}
                              {event.status === 'error' && <ErrorOutlineIcon color="error" sx={{ mr: 1, fontSize: 16 }} />}
                              {event.message}
                            </Box>
                          }
                          secondary={`${event.timestamp} - ${event.device}`}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                      {index < events.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 2 }}>
                  No hay eventos recientes
                </Typography>
              )}
            </Paper>

            <Box mt={4} mb={4}>
              <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                <Paper 
                  elevation={4} 
                  sx={{ 
                    p: 3, 
                    borderRadius: 3,
                    background: 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
                    border: '1px solid rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <Box 
                      display="grid" 
                      gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)' }} 
                      gap={2}
                      width="100%"
                      mb={3}
                    >
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
                    </Box>
                  </Box>
                </Paper>
              </Zoom>
            </Box>
            
            <Box mt={4} textAlign="center">
              <Typography variant="caption" color="textSecondary">
                Conexión segura · {new Date().getFullYear()}
              </Typography>
            </Box>
          </Box>
        </Fade>
      </Container>
      
      {/* Notificaciones */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
