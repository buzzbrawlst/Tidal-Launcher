using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media.Imaging;
using TidalLauncher.Services;

namespace TidalLauncher;

public partial class MainWindow : Window
{
    private const string HERO_URL =
        "https://assetsio.gnwcdn.com/fortnite-chapter-2-season-3-a.jpg?width=1600&height=900&fit=crop&quality=100&format=png&enable=upscale&auto=png";

    private const string NEWS_FILE = "news.html";

    private bool _loggedIn;
    private string? _token;
    private bool _oauthReady;

    public MainWindow()
    {
        InitializeComponent();

        LoadImages();
        SetupNewsBrowser();
        _ = RestoreSessionAsync();
    }

    private void LoadImages()
    {
        try
        {
            HeroImage.Source = new BitmapImage(new Uri(HERO_URL));
        }
        catch (Exception ex)
        {
            Debug.WriteLine(ex.Message);
        }
    }

    private async void SetupNewsBrowser()
    {
        try
        {
            await NewsBrowser.EnsureCoreWebView2Async();

            string path = System.IO.Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                NEWS_FILE);

            if (System.IO.File.Exists(path))
            {
                NewsBrowser.Source = new Uri(path, UriKind.Absolute);
            }
            else
            {
                MessageBox.Show(
                    "news.html was not found.\n\nPlace news.html next to the launcher executable.",
                    "Tidal News",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Could not load the news page.\n\n" + ex.Message,
                "Tidal Launcher",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private async Task RestoreSessionAsync()
    {
        var token = SessionManager.Load();
        if (string.IsNullOrWhiteSpace(token))
        {
            AccountButton.Content = "LOGIN";
            return;
        }

        try
        {
            var result = await ApiService.GetMeAsync(token);
            if (result == null || !result.RootElement.TryGetProperty("authenticated", out var authenticated) || !authenticated.GetBoolean())
            {
                SessionManager.Logout();
                AccountButton.Content = "LOGIN";
                return;
            }

            _token = token;
            _loggedIn = true;
            SetAccountButton(result);
            LaunchButton.IsEnabled = true;
        }
        catch
        {
            // Keep the stored session so a temporary backend/network failure does not log the user out.
            AccountButton.Content = "OFFLINE";
            LaunchButton.IsEnabled = false;
        }
    }

    private void SetAccountButton(JsonDocument result)
    {
        string username = "ACCOUNT";

        if (result.RootElement.TryGetProperty("user", out var user) &&
            user.TryGetProperty("username", out var usernameElement))
        {
            username = usernameElement.GetString() ?? "ACCOUNT";
        }

        AccountButton.Content = username.Length > 14
            ? username[..14] + "…"
            : username;
    }

    private void HomeButton_Click(object sender, RoutedEventArgs e)
    {
        HomePanel.Visibility = Visibility.Visible;
        NewsPanel.Visibility = Visibility.Collapsed;
    }

    private void NewsButton_Click(object sender, RoutedEventArgs e)
    {
        HomePanel.Visibility = Visibility.Collapsed;
        NewsPanel.Visibility = Visibility.Visible;
    }

    private void DiscordButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "https://discord.com",
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Discord", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void AccountButton_Click(object sender, RoutedEventArgs e)
    {
        if (_loggedIn)
        {
            var result = MessageBox.Show(
                "You are currently signed into Tidal.\n\nDo you want to log out?",
                "Tidal Account",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
                Logout();

            return;
        }

        await ShowLoginAsync();
    }

    private async Task ShowLoginAsync()
    {
        LoginOverlay.Visibility = Visibility.Visible;
        LoginCard.Visibility = Visibility.Visible;
        OAuthBrowser.Visibility = Visibility.Collapsed;
        LoginButton.IsEnabled = true;
        LoginProgress.Visibility = Visibility.Collapsed;
        LoginStatus.Text = "Sign in with Discord to continue.";

        try
        {
            await OAuthBrowser.EnsureCoreWebView2Async();
            _oauthReady = true;
            OAuthBrowser.NavigationCompleted -= OAuthBrowser_NavigationCompleted;
            OAuthBrowser.NavigationCompleted += OAuthBrowser_NavigationCompleted;
        }
        catch (Exception ex)
        {
            LoginStatus.Text = "Could not start the login browser.\n" + ex.Message;
        }
    }

    private async void LoginButton_Click(object sender, RoutedEventArgs e)
    {
        if (!_oauthReady)
            await ShowLoginAsync();

        try
        {
            LoginButton.IsEnabled = false;
            LoginProgress.Visibility = Visibility.Visible;
            LoginStatus.Text = "Opening Discord…";
            LoginCard.Visibility = Visibility.Collapsed;
            OAuthBrowser.Visibility = Visibility.Visible;
            OAuthBrowser.Source = new Uri($"{ApiService.Backend}/auth/discord");
        }
        catch (Exception ex)
        {
            LoginCard.Visibility = Visibility.Visible;
            OAuthBrowser.Visibility = Visibility.Collapsed;
            LoginProgress.Visibility = Visibility.Collapsed;
            LoginButton.IsEnabled = true;
            LoginStatus.Text = "Could not open Discord.\n" + ex.Message;
        }
    }

    private async void OAuthBrowser_NavigationCompleted(object? sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs e)
    {
        if (OAuthBrowser.Source == null ||
            !OAuthBrowser.Source.AbsolutePath.Equals("/auth/callback", StringComparison.OrdinalIgnoreCase))
            return;

        try
        {
            // The backend returns a JSON response at /auth/callback.
            // WebView2 lets the launcher read that response without placing the JWT in a custom URL.
            var bodyJson = await OAuthBrowser.CoreWebView2.ExecuteScriptAsync("document.body.innerText");
            var body = JsonSerializer.Deserialize<string>(bodyJson) ?? string.Empty;
            var authResponse = JsonDocument.Parse(body);

            if (!authResponse.RootElement.TryGetProperty("success", out var success) || !success.GetBoolean())
                throw new InvalidOperationException("Discord authentication failed.");

            if (!authResponse.RootElement.TryGetProperty("token", out var tokenElement))
                throw new InvalidOperationException("Tidal did not return a session token.");

            var token = tokenElement.GetString();
            if (string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException("Tidal returned an empty session token.");

            SessionManager.Save(token);
            _token = token;
            _loggedIn = true;

            if (authResponse.RootElement.TryGetProperty("user", out var user))
            {
                using var userDoc = JsonDocument.Parse(JsonSerializer.Serialize(new
                {
                    authenticated = true,
                    user
                }));
                SetAccountButton(userDoc);
            }
            else
            {
                AccountButton.Content = "ACCOUNT";
            }

            LoginOverlay.Visibility = Visibility.Collapsed;
            OAuthBrowser.Visibility = Visibility.Collapsed;
            LaunchButton.IsEnabled = true;
        }
        catch (Exception ex)
        {
            OAuthBrowser.Visibility = Visibility.Collapsed;
            LoginCard.Visibility = Visibility.Visible;
            LoginProgress.Visibility = Visibility.Collapsed;
            LoginButton.IsEnabled = true;
            LoginStatus.Text = "Login failed.\n" + ex.Message;
        }
    }

    private void CloseLogin_Click(object sender, RoutedEventArgs e)
    {
        OAuthBrowser.Visibility = Visibility.Collapsed;
        LoginOverlay.Visibility = Visibility.Collapsed;
    }

    private void Logout()
    {
        SessionManager.Logout();
        _token = null;
        _loggedIn = false;
        AccountButton.Content = "LOGIN";
        LaunchButton.IsEnabled = false;
    }

    private void LaunchButton_Click(object sender, RoutedEventArgs e)
    {
        if (!_loggedIn || string.IsNullOrWhiteSpace(_token))
        {
            _ = ShowLoginAsync();
            return;
        }

        MessageBox.Show(
            "Tidal launch system is not connected yet.\n\nYou are authenticated and ready for the next launcher phase.",
            "Tidal Launcher",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }
}